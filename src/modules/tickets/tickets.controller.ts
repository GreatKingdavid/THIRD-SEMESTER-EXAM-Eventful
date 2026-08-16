import { Request, Response, NextFunction } from "express";
import { ticketsService } from "./tickets.service";

export class TicketsController {
  async listMine(req: Request, res: Response, next: NextFunction) {
    try {
      const tickets = await ticketsService.listMine(req.user!.userId);
      res.status(200).json(tickets);
    } catch (err) {
      next(err);
    }
  }

  async listAttendeesForEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const attendees = await ticketsService.listAttendeesForEvent(
        req.params.eventId,
        req.user!.userId
      );
      res.status(200).json(attendees);
    } catch (err) {
      next(err);
    }
  }

  async scan(req: Request, res: Response, next: NextFunction) {
    try {
      const { qrCodeData } = req.body;
      const ticket = await ticketsService.scanTicket(qrCodeData, req.params.eventId);
      res.status(200).json({ message: "Ticket verified", ticket });
    } catch (err) {
      next(err);
    }
  }
}

export const ticketsController = new TicketsController();
