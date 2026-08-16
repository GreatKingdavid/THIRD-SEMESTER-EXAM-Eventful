import { prisma } from "../../config/db";
import { ApiError } from "../../utils/apiError";
import { cacheAside } from "../../utils/cache";

export class AnalyticsService {
  /** All-time totals across every event a creator owns */
  async globalStatsForCreator(creatorId: string) {
    const cacheKey = `analytics:global:${creatorId}`;
    return cacheAside(
      cacheKey,
      async () => {
        const events = await prisma.event.findMany({
          where: { creatorId },
          select: { id: true },
        });
        const eventIds = events.map((e) => e.id);

        const [totalAttendees, totalTicketsPaid, totalScanned, totalRevenue] = await Promise.all([
          prisma.ticket.count({ where: { eventId: { in: eventIds } } }),
          prisma.ticket.count({ where: { eventId: { in: eventIds }, status: "PAID" } }),
          prisma.ticket.count({ where: { eventId: { in: eventIds }, status: "SCANNED" } }),
          prisma.payment.aggregate({
            where: { ticket: { eventId: { in: eventIds } }, status: "SUCCESS" },
            _sum: { amount: true },
          }),
        ]);

        return {
          totalEvents: eventIds.length,
          totalAttendees,
          totalTicketsPaid,
          totalScanned,
          totalRevenue: totalRevenue._sum.amount ?? 0,
        };
      },
      120 // shorter TTL since numbers change often
    );
  }

  /** Stats specific to a single event */
  async statsForEvent(eventId: string, creatorId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw ApiError.notFound("Event not found");
    if (event.creatorId !== creatorId) throw ApiError.forbidden("You do not own this event");

    const cacheKey = `analytics:event:${eventId}`;
    return cacheAside(
      cacheKey,
      async () => {
        const [totalAttendees, totalTicketsPaid, totalScanned, revenue] = await Promise.all([
          prisma.ticket.count({ where: { eventId } }),
          prisma.ticket.count({ where: { eventId, status: "PAID" } }),
          prisma.ticket.count({ where: { eventId, status: "SCANNED" } }),
          prisma.payment.aggregate({
            where: { ticket: { eventId }, status: "SUCCESS" },
            _sum: { amount: true },
          }),
        ]);

        return {
          eventId,
          totalAttendees,
          totalTicketsPaid,
          totalScanned,
          scanRate: totalTicketsPaid > 0 ? totalScanned / totalTicketsPaid : 0,
          totalRevenue: revenue._sum.amount ?? 0,
        };
      },
      120
    );
  }
}

export const analyticsService = new AnalyticsService();
