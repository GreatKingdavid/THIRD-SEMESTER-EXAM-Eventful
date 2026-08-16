import { Router } from "express";
import { notificationsController } from "./notifications.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { setReminderSchema } from "./notifications.validation";

const router = Router();

/**
 * @swagger
 * /api/notifications/reminders:
 *   post:
 *     summary: Set a personal, fully flexible reminder for an event (eventees)
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventId, minutesBeforeEvent]
 *             properties:
 *               eventId: { type: string }
 *               minutesBeforeEvent: { type: integer, description: "e.g. 60, 1440, 10080" }
 *   get:
 *     summary: List my reminders
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 */
router.post(
  "/reminders",
  authenticate,
  authorize("EVENTEE"),
  validate(setReminderSchema),
  notificationsController.setReminder
);
router.get("/reminders", authenticate, authorize("EVENTEE"), notificationsController.listMine);

/**
 * @swagger
 * /api/notifications/reminders/{id}:
 *   delete:
 *     summary: Cancel a reminder
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 */
router.delete(
  "/reminders/:id",
  authenticate,
  authorize("EVENTEE"),
  notificationsController.remove
);

export default router;
