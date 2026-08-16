import { Request, Response, NextFunction } from "express";
import { paymentsService } from "./payments.service";
import { ApiError } from "../../utils/apiError";
import { logger } from "../../utils/logger";

export class PaymentsController {
  async initialize(req: Request, res: Response, next: NextFunction) {
    try {
      const { eventId } = req.body;
      const result = await paymentsService.initializeTicketPurchase(eventId, req.user!.userId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async verify(req: Request, res: Response, next: NextFunction) {
    try {
      const { reference } = req.params;
      const result = await paymentsService.verifyTransaction(reference);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /** Paystack calls this endpoint automatically after a transaction completes */
  async webhook(req: Request, res: Response) {
    try {
      const signature = req.headers["x-paystack-signature"] as string | undefined;
      const rawBody = (req as unknown as { rawBody: string }).rawBody;

      if (!paymentsService.verifyWebhookSignature(rawBody, signature)) {
        throw ApiError.unauthorized("Invalid Paystack signature");
      }

      const event = req.body;
      if (event.event === "charge.success") {
        await paymentsService.markPaymentSuccess(event.data.reference);
      }

      // Always 200 quickly so Paystack doesn't retry unnecessarily
      res.status(200).json({ received: true });
    } catch (err) {
      logger.error(`Webhook error: ${(err as Error).message}`);
      res.status(200).json({ received: true }); // ack anyway per Paystack best practice
    }
  }

  async listForCreator(req: Request, res: Response, next: NextFunction) {
    try {
      const eventId = req.query.eventId as string | undefined;
      const payments = await paymentsService.listPaymentsForCreator(req.user!.userId, eventId);
      res.status(200).json(payments);
    } catch (err) {
      next(err);
    }
  }
}

export const paymentsController = new PaymentsController();
