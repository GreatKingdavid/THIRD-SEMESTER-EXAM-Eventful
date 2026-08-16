import { Router } from "express";
import { analyticsController } from "./analytics.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";

const router = Router();

/**
 * @swagger
 * /api/analytics/global:
 *   get:
 *     summary: All-time stats across all events owned by the logged-in creator
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 */
router.get("/global", authenticate, authorize("CREATOR"), analyticsController.global);

/**
 * @swagger
 * /api/analytics/event/{eventId}:
 *   get:
 *     summary: Stats for one specific event (attendees, tickets bought, QR scans)
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 */
router.get(
  "/event/:eventId",
  authenticate,
  authorize("CREATOR"),
  analyticsController.forEvent
);

export default router;
