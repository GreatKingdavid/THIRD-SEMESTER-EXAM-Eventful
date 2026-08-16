import { Request, Response, NextFunction } from "express";
import { analyticsService } from "./analytics.service";

export class AnalyticsController {
  async global(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await analyticsService.globalStatsForCreator(req.user!.userId);
      res.status(200).json(stats);
    } catch (err) {
      next(err);
    }
  }

  async forEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await analyticsService.statsForEvent(req.params.eventId, req.user!.userId);
      res.status(200).json(stats);
    } catch (err) {
      next(err);
    }
  }
}

export const analyticsController = new AnalyticsController();
