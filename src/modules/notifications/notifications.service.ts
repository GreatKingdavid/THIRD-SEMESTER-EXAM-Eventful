import { prisma } from "../../config/db";
import { logger } from "../../utils/logger";
import { ApiError } from "../../utils/apiError";

// Common presets to make the API easy to consume from a frontend dropdown,
// though any positive integer of minutes is accepted (fully flexible per the brief).
export const REMINDER_PRESETS_MINUTES = {
  "15_MINUTES": 15,
  "1_HOUR": 60,
  "1_DAY": 1440,
  "1_WEEK": 10080,
};

export class NotificationsService {
  /** Eventee sets their own personal reminder for an event they're attending */
  async setReminderForUser(userId: string, eventId: string, minutesBeforeEvent: number) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw ApiError.notFound("Event not found");

    return prisma.reminder.create({
      data: { eventId, userId, minutesBeforeEvent },
    });
  }

  async listMyReminders(userId: string) {
    return prisma.reminder.findMany({
      where: { userId },
      include: { event: { select: { id: true, title: true, date: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async deleteReminder(id: string, userId: string) {
    const reminder = await prisma.reminder.findUnique({ where: { id } });
    if (!reminder) throw ApiError.notFound("Reminder not found");
    if (reminder.userId !== userId) throw ApiError.forbidden("Not your reminder");
    await prisma.reminder.delete({ where: { id } });
  }

  /**
   * When a creator sets `defaultReminderMinutesBefore` on an event, and an eventee
   * buys a ticket without specifying their own reminder, we auto-create one for them
   * using the creator's default. Called from the tickets/payments flow.
   */
  async createDefaultReminderIfNeeded(eventId: string, userId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event || !event.defaultReminderMinutesBefore) return null;

    const existing = await prisma.reminder.findFirst({ where: { eventId, userId } });
    if (existing) return existing;

    return prisma.reminder.create({
      data: {
        eventId,
        userId,
        minutesBeforeEvent: event.defaultReminderMinutesBefore,
      },
    });
  }

  /**
   * Called by the cron scheduler every minute. Finds reminders whose fire-time has
   * arrived (event.date - minutesBeforeEvent <= now) and haven't been sent yet.
   */
  async sendDueReminders() {
    const now = new Date();

    const dueReminders = await prisma.reminder.findMany({
      where: { sent: false },
      include: { event: true, user: true },
    });

    const toSend = dueReminders.filter((r) => {
      const fireAt = new Date(r.event.date.getTime() - r.minutesBeforeEvent * 60_000);
      return fireAt <= now && r.event.date > now; // don't notify for past events
    });

    for (const reminder of toSend) {
      // In production, plug in an email/SMS/push provider here (e.g. SendGrid, Twilio, FCM).
      logger.info(
        `[REMINDER] To ${reminder.user.email}: "${reminder.event.title}" starts in ${reminder.minutesBeforeEvent} minutes`
      );

      await prisma.reminder.update({ where: { id: reminder.id }, data: { sent: true } });
    }

    return toSend.length;
  }
}

export const notificationsService = new NotificationsService();
