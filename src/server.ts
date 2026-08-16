import { app } from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { startReminderScheduler } from "./modules/notifications/notifications.scheduler";

app.listen(env.port, () => {
  logger.info(`Eventful API running on ${env.appUrl} (port ${env.port})`);
  logger.info(`Swagger docs available at ${env.appUrl}/api-docs`);
  startReminderScheduler();
});
