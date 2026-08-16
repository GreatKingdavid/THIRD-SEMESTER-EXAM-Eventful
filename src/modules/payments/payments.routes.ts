import { Router } from "express";
import { paymentsController } from "./payments.controller";
import { authenticate } from "../../middlewares/auth.middleware";
import { authorize } from "../../middlewares/role.middleware";

const router = Router();

/**
 * @swagger
 * /api/payments/initialize:
 *   post:
 *     summary: Start a Paystack payment for a ticket (eventees only)
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventId]
 *             properties:
 *               eventId: { type: string }
 *     responses:
 *       200: { description: Returns Paystack authorization_url to redirect the user to }
 */
router.post("/initialize", authenticate, authorize("EVENTEE"), paymentsController.initialize);

/**
 * @swagger
 * /api/payments/verify/{reference}:
 *   get:
 *     summary: Manually verify a Paystack transaction (fallback to webhook)
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 */
router.get("/verify/:reference", authenticate, paymentsController.verify);

/**
 * @swagger
 * /api/payments/webhook:
 *   post:
 *     summary: Paystack webhook endpoint (called by Paystack, not the client)
 *     tags: [Payments]
 */
router.post("/webhook", paymentsController.webhook);

/**
 * @swagger
 * /api/payments/mine:
 *   get:
 *     summary: List all payments for events the logged-in creator owns
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 */
router.get("/mine", authenticate, authorize("CREATOR"), paymentsController.listForCreator);

export default router;
