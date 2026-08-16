import { Request, Response, NextFunction } from "express";
import { eventsService } from "./events.service";
import { env } from "../../config/env";

export class EventsController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const event = await eventsService.create(req.user!.userId, req.body);
      res.status(201).json(event);
    } catch (err) {
      next(err);
    }
  }

  async listAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page ?? 1);
      const pageSize = Number(req.query.pageSize ?? 20);
      const result = await eventsService.listAll(page, pageSize);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async listMine(req: Request, res: Response, next: NextFunction) {
    try {
      const events = await eventsService.listByCreator(req.user!.userId);
      res.status(200).json(events);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const event = await eventsService.getById(req.params.id);
      res.status(200).json(event);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const event = await eventsService.update(req.params.id, req.user!.userId, req.body);
      res.status(200).json(event);
    } catch (err) {
      next(err);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await eventsService.remove(req.params.id, req.user!.userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async share(req: Request, res: Response, next: NextFunction) {
    try {
      const event = await eventsService.getById(req.params.id);
      const links = eventsService.buildShareLinks(event.id, event.title, env.appUrl);
      res.status(200).json(links);
    } catch (err) {
      next(err);
    }
  }
}

export const eventsController = new EventsController();
