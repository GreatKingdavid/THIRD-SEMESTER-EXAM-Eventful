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
   * Step 1: eventee wants a ticket -> create a PENDING ticket + PENDING payment,
   * then ask Paystack to initialize a transaction and return the checkout URL.
   */
  async initializeTicketPurchase(eventId: string, userId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw ApiError.notFound("Event not found");

    const existingTicket = await prisma.ticket.findUnique({
      where: { uniqueTicketPerUserPerEvent: { eventId, userId } },
    });
    if (existingTicket && existingTicket.status === "PAID") {
      throw ApiError.conflict("You already have a ticket for this event");
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const ticket =
      existingTicket ??
      (await prisma.ticket.create({ data: { eventId, userId, status: "PENDING" } }));

    const paystackRef = `evtf_${ticket.id}_${Date.now()}`;
    const amountKobo = Math.round(event.price * 100); // Paystack expects the smallest currency unit

    const { data } = await paystackClient.post("/transaction/initialize", {
      email: user.email,
      amount: amountKobo,
      reference: paystackRef,
      metadata: { ticketId: ticket.id, eventId, userId },
    });

    await prisma.payment.upsert({
      where: { ticketId: ticket.id },
      create: {
        ticketId: ticket.id,
        amount: event.price,
        paystackRef,
        status: "PENDING",
      },
      update: { paystackRef, status: "PENDING" },
    });

    return {
      authorizationUrl: data.data.authorization_url,
      reference: paystackRef,
      ticketId: ticket.id,
    };
  }

  /** Step 2: verify a transaction directly with Paystack (used as a fallback to the webhook) */
  async verifyTransaction(reference: string) {
    const { data } = await paystackClient.get(`/transaction/verify/${reference}`);
    if (data.data.status === "success") {
      return this.markPaymentSuccess(reference);
    }
    return this.markPaymentFailed(reference);
  }

  /** Validates Paystack's webhook signature (x-paystack-signature header) */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean {
    if (!signatureHeader) return false;
    const hash = crypto
      .createHmac("sha512", env.paystackSecretKey)
      .update(rawBody)
      .digest("hex");
    return hash === signatureHeader;
  }

  /** Called after a successful webhook event or manual verification */
  async markPaymentSuccess(reference: string) {
    const payment = await prisma.payment.findUnique({ where: { paystackRef: reference } });
    if (!payment) throw ApiError.notFound("Payment not found for this reference");

    if (payment.status === "SUCCESS") return payment; // idempotent

    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCESS", paidAt: new Date() },
    });

    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: payment.ticketId } });
    const qr = await qrCodeService.generate({
      ticketId: ticket.id,
      eventId: ticket.eventId,
      userId: ticket.userId,
    });

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: "PAID", qrCodeData: qr.qrCodeData, qrCodeImage: qr.qrCodeImage },
    });

    await invalidateCache(`analytics:event:${ticket.eventId}`);
    await invalidateCache("analytics:global");

    return updatedPayment;
  }

  async markPaymentFailed(reference: string) {
    const payment = await prisma.payment.findUnique({ where: { paystackRef: reference } });
    if (!payment) throw ApiError.notFound("Payment not found for this reference");

    return prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });
  }

  /** Creator-facing: all payments for events they own, optionally filtered to one event */
  async listPaymentsForCreator(creatorId: string, eventId?: string) {
    return prisma.payment.findMany({
      where: {
        ticket: {
          event: { creatorId, ...(eventId ? { id: eventId } : {}) },
        },
      },
      include: {
        ticket: {
          include: {
            event: { select: { id: true, title: true } },
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const paymentsService = new PaymentsService();
