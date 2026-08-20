import axios from "axios";
import crypto from "crypto";
import { env } from "../../config/env";
import { prisma } from "../../config/db";
import { ApiError } from "../../utils/apiError";
import { invalidateCache } from "../../utils/cache";
import { qrCodeService } from "../tickets/qrcode.service";

const paystackClient = axios.create({
  baseURL: env.paystackBaseUrl,
  headers: {
    Authorization: `Bearer ${env.paystackSecretKey}`,
    "Content-Type": "application/json",
  },
});

export class PaymentsService {
  /**
   * Step 1: Eventee wants a ticket.
   *
   * FREE EVENT:
   * - No Paystack transaction is created.
   * - Ticket is issued immediately.
   * - QR code is generated immediately.
   *
   * PAID EVENT:
   * - Create/reuse a PENDING ticket.
   * - Create/reuse a PENDING payment.
   * - Initialize a Paystack transaction.
   * - Return the Paystack checkout URL.
   */
  async initializeTicketPurchase(eventId: string, userId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw ApiError.notFound("Event not found");
    }

    const existingTicket = await prisma.ticket.findUnique({
      where: {
        uniqueTicketPerUserPerEvent: {
          eventId,
          userId,
        },
      },
    });

    if (existingTicket && existingTicket.status === "PAID") {
      throw ApiError.conflict("You already have a ticket for this event");
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    // ============================================================
    // FREE EVENT
    // ============================================================
    //
    // Paystack does NOT support amount: 0.
    // Therefore, free events completely bypass Paystack.
    //
    if (event.price <= 0) {
      const ticket =
        existingTicket ??
        (await prisma.ticket.create({
          data: {
            eventId,
            userId,
            status: "PAID",
          },
        }));

      const qr = await qrCodeService.generate({
        ticketId: ticket.id,
        eventId: ticket.eventId,
        userId: ticket.userId,
      });

      const updatedTicket = await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: "PAID",
          qrCodeData: qr.qrCodeData,
          qrCodeImage: qr.qrCodeImage,
        },
      });

      await invalidateCache(`analytics:event:${eventId}`);
      await invalidateCache("analytics:global");

      return {
        free: true,
        ticketId: updatedTicket.id,
        message: "Free ticket issued successfully",
        qrCodeData: updatedTicket.qrCodeData,
        qrCodeImage: updatedTicket.qrCodeImage,
      };
    }

    // ============================================================
    // PAID EVENT
    // ============================================================

    const ticket =
      existingTicket ??
      (await prisma.ticket.create({
        data: {
          eventId,
          userId,
          status: "PENDING",
        },
      }));

    // Paystack expects the amount in the smallest currency unit.
    // For NGN:
    // ₦1,000 -> 100,000 kobo
    const amountKobo = Math.round(event.price * 100);

    if (amountKobo <= 0) {
      throw ApiError.badRequest(
        "Invalid event price. Paid events must have a price greater than zero."
      );
    }

    const paystackRef = `evtf_${ticket.id}_${Date.now()}`;

    let data;

    try {
      const response = await paystackClient.post(
        "/transaction/initialize",
        {
          email: user.email,
          amount: amountKobo,
          reference: paystackRef,
          metadata: {
            ticketId: ticket.id,
            eventId,
            userId,
          },
        }
      );

      data = response.data;
    } catch (err) {
      // Surface Paystack's actual rejection reason instead of
      // returning a generic error.
      const axiosErr = err as {
        response?: {
          data?: unknown;
        };
      };

      throw ApiError.badRequest(
        `Paystack rejected the transaction: ${JSON.stringify(
          axiosErr.response?.data ?? (err as Error).message
        )}`
      );
    }

    await prisma.payment.upsert({
      where: {
        ticketId: ticket.id,
      },
      create: {
        ticketId: ticket.id,
        amount: event.price,
        paystackRef,
        status: "PENDING",
      },
      update: {
        paystackRef,
        amount: event.price,
        status: "PENDING",
      },
    });

    return {
      free: false,
      authorizationUrl: data.data.authorization_url,
      reference: paystackRef,
      ticketId: ticket.id,
    };
  }

  /**
   * Step 2: Verify a transaction directly with Paystack.
   *
   * Used as a fallback to the webhook.
   */
  async verifyTransaction(reference: string) {
    const { data } = await paystackClient.get(
      `/transaction/verify/${reference}`
    );

    if (data.data.status === "success") {
      return this.markPaymentSuccess(reference);
    }

    return this.markPaymentFailed(reference);
  }

  /**
   * Validates Paystack's webhook signature.
   */
  verifyWebhookSignature(
    rawBody: string,
    signatureHeader: string | undefined
  ): boolean {
    if (!signatureHeader) return false;

    const hash = crypto
      .createHmac("sha512", env.paystackSecretKey)
      .update(rawBody)
      .digest("hex");

    return hash === signatureHeader;
  }

  /**
   * Called after a successful webhook event
   * or manual transaction verification.
   *
   * This method is intentionally idempotent:
   * if Paystack sends the same successful event twice,
   * we don't process the payment twice.
   */
  async markPaymentSuccess(reference: string) {
    const payment = await prisma.payment.findUnique({
      where: {
        paystackRef: reference,
      },
    });

    if (!payment) {
      throw ApiError.notFound(
        "Payment not found for this reference"
      );
    }

    // Idempotency protection.
    if (payment.status === "SUCCESS") {
      return payment;
    }

    const updatedPayment = await prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        status: "SUCCESS",
        paidAt: new Date(),
      },
    });

    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: {
        id: payment.ticketId,
      },
    });

    const qr = await qrCodeService.generate({
      ticketId: ticket.id,
      eventId: ticket.eventId,
      userId: ticket.userId,
    });

    await prisma.ticket.update({
      where: {
        id: ticket.id,
      },
      data: {
        status: "PAID",
        qrCodeData: qr.qrCodeData,
        qrCodeImage: qr.qrCodeImage,
      },
    });

    await invalidateCache(
      `analytics:event:${ticket.eventId}`
    );

    await invalidateCache("analytics:global");

    return updatedPayment;
  }

  /**
   * Marks a Paystack transaction as failed.
   */
  async markPaymentFailed(reference: string) {
    const payment = await prisma.payment.findUnique({
      where: {
        paystackRef: reference,
      },
    });

    if (!payment) {
      throw ApiError.notFound(
        "Payment not found for this reference"
      );
    }

    return prisma.payment.update({
      where: {
        id: payment.id,
      },
      data: {
        status: "FAILED",
      },
    });
  }

  /**
   * Creator-facing:
   * Get all payments for events owned by the creator.
   *
   * Optionally filter to a single event.
   */
  async listPaymentsForCreator(
    creatorId: string,
    eventId?: string
  ) {
    return prisma.payment.findMany({
      where: {
        ticket: {
          event: {
            creatorId,
            ...(eventId ? { id: eventId } : {}),
          },
        },
      },
      include: {
        ticket: {
          include: {
            event: {
              select: {
                id: true,
                title: true,
              },
            },
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }
}

export const paymentsService = new PaymentsService();