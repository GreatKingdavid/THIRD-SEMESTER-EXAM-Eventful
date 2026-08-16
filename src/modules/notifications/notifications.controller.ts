import { Request, Response, NextFunction } from "express";
import { notificationsService } from "./notifications.service";

export class NotificationsController {
  async setReminder(req: Request, res: Response, next: NextFunction) {
    try {
      const { eventId, minutesBeforeEvent } = req.body;
      const reminder = await notificationsService.setReminderForUser(
        req.user!.userId,
        eventId,
        minutesBeforeEvent
      );
      res.status(201).json(reminder);
    } catch (err) {
      next(err);
    }
  }

  async listMine(req: Request, res: Response, next: NextFunction) {
    try {
      const reminders = await notificationsService.listMyReminders(req.user!.userId);
      res.status(200).json(reminders);
    } catch (err) {
      next(err);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await notificationsService.deleteReminder(req.params.id, req.user!.userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

export const notificationsController = new NotificationsController();
