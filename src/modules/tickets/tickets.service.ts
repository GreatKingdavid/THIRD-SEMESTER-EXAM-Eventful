import { prisma } from "../../config/db";
import { ApiError } from "../../utils/apiError";
import { qrCodeService } from "./qrcode.service";
import { invalidateCache } from "../../utils/cache";

export class TicketsService {
  /** Eventee: tickets they hold (across all events they've applied/paid for) */
  async listMine(userId: string) {
    return prisma.ticket.findMany({
      where: { userId },
      include: { event: true, payment: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Creator: everyone who has applied/bought a ticket to one of their events */
  async listAttendeesForEvent(eventId: string, creatorId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw ApiError.notFound("Event not found");
    if (event.creatorId !== creatorId) throw ApiError.forbidden("You do not own this event");

    return prisma.ticket.findMany({
      where: { eventId },
      include: { user: { select: { id: true, name: true, email: true } }, payment: true },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Gate staff / creator scans a QR code at the door */
  async scanTicket(qrCodeData: string, eventId: string) {
    const result = qrCodeService.verify(qrCodeData);
    if (!result.valid || !result.payload) {
      throw ApiError.badRequest("Invalid or tampered QR code");
    }

    const { ticketId, eventId: qrEventId } = result.payload;
    if (qrEventId !== eventId) {
      throw ApiError.badRequest("This ticket is not valid for this event");
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw ApiError.notFound("Ticket not found");
    if (ticket.status !== "PAID" && ticket.status !== "SCANNED") {
      throw ApiError.badRequest("Ticket has not been paid for");
    }
    if (ticket.status === "SCANNED") {
      throw ApiError.conflict("Ticket has already been scanned");
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: "SCANNED", scannedAt: new Date() },
    });

    await invalidateCache(`analytics:event:${eventId}`);
    return updated;
  }
}

export const ticketsService = new TicketsService();
