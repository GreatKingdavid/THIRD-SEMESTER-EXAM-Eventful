import { Router } from "express";
import { ticketsController } from "./tickets.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";

const router = Router();

/**
 * @swagger
 * /api/tickets/mine:
 *   get:
 *     summary: List tickets belonging to the logged-in eventee (includes QR code image)
 *     tags: [Tickets]
 *     security: [{ bearerAuth: [] }]
 */
router.get("/mine", authenticate, authorize("EVENTEE"), ticketsController.listMine);

/**
 * @swagger
 * /api/tickets/event/{eventId}/attendees:
 *   get:
 *     summary: List all attendees/tickets for an event (creator only)
 *     tags: [Tickets]
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  "/event/:eventId/attendees",
  authenticate,
  authorize("CREATOR"),
  ticketsController.listAttendeesForEvent
);

/**
 * @swagger
 * /api/tickets/event/{eventId}/scan:
 *   post:
 *     summary: Scan/verify a ticket's QR code at the gate (creator only)
 *     tags: [Tickets]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [qrCodeData]
 *             properties:
 *               qrCodeData: { type: string }
 */
router.post(
  "/event/:eventId/scan",
  authenticate,
  authorize("CREATOR"),
  ticketsController.scan
);

export default router;
