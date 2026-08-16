import { Router } from "express";
import { eventsController } from "./events.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { createEventSchema, updateEventSchema, eventIdParamSchema } from "./events.validation";

const router = Router();

/**
 * @swagger
 * /api/events/{id}:
 *   get:
 *     summary: Get a single event
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *   put:
 *     summary: Update an event (owner only)
 *     tags: [Events]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               location: { type: string }
 *               date: { type: string, format: date-time }
 *               price: { type: number }
 *               capacity: { type: integer }
 *               defaultReminderMinutesBefore: { type: integer }
 *   delete:
 *     summary: Delete an event (owner only)
 *     tags: [Events]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 */
router.post(
  "/",
  authenticate,
  authorize("CREATOR"),
  validate(createEventSchema),
  eventsController.create
);
router.get("/", eventsController.listAll);

/**
 * @swagger
 * /api/events/mine:
 *   get:
 *     summary: List events created by the logged-in creator
 *     tags: [Events]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Creator's own events }
 */
router.get("/mine", authenticate, authorize("CREATOR"), eventsController.listMine);

/**
 * @swagger
 * /api/events/{id}:
 *   get:
 *     summary: Get a single event
 *     tags: [Events]
 *   put:
 *     summary: Update an event (owner only)
 *     tags: [Events]
 *     security: [{ bearerAuth: [] }]
 *   delete:
 *     summary: Delete an event (owner only)
 *     tags: [Events]
 *     security: [{ bearerAuth: [] }]
 */
router.get("/:id", validate(eventIdParamSchema), eventsController.getById);
router.put(
  "/:id",
  authenticate,
  authorize("CREATOR"),
  validate(updateEventSchema),
  eventsController.update
);
router.delete(
  "/:id",
  authenticate,
  authorize("CREATOR"),
  validate(eventIdParamSchema),
  eventsController.remove
);

/**
 * @swagger
 * /api/events/{id}/share:
 *   get:
 *     summary: Get shareable social-media links for an event
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 */
router.get("/:id/share", validate(eventIdParamSchema), eventsController.share);

export default router;
