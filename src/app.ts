import express, { Request } from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";

import { swaggerSpec } from "./config/swagger";
import { globalLimiter } from "./middlewares/rateLimiter.middleware";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";

import authRoutes from "./modules/auth/auth.routes";
import eventsRoutes from "./modules/events/events.routes";
import ticketsRoutes from "./modules/tickets/tickets.routes";
import paymentsRoutes from "./modules/payments/payments.routes";
import notificationsRoutes from "./modules/notifications/notifications.routes";
import analyticsRoutes from "./modules/analytics/analytics.routes";

export const app = express();

// Render (and most hosting platforms) sit behind a reverse proxy that adds
// X-Forwarded-For. Without this, express-rate-limit can't safely identify
// clients and throws on every request.
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors());
app.use(globalLimiter);

// Capture the raw body ONLY for the Paystack webhook route, needed to verify its HMAC signature.
app.use(
  express.json({
    verify: (req: Request & { rawBody?: string }, _res, buf) => {
      if (req.originalUrl === "/api/payments/webhook") {
        req.rawBody = buf.toString();
      }
    },
  })
);

app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/auth", authRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/tickets", ticketsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/analytics", analyticsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);