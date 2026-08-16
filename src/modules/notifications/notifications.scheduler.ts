import cron from "node-cron";
import { notificationsService } from "./notifications.service";
import { logger } from "../../utils/logger";

/** Runs every minute, checking for reminders whose fire-time has arrived. */
export function startReminderScheduler() {
  cron.schedule("* * * * *", async () => {
    try {
      const count = await notificationsService.sendDueReminders();
      if (count > 0) logger.info(`Sent ${count} reminder(s)`);
    } catch (err) {
      logger.error(`Reminder scheduler error: ${(err as Error).message}`);
    }
  });
  logger.info("Reminder scheduler started (runs every minute)");
}
