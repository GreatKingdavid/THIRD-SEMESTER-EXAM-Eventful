import swaggerJSDoc from "swagger-jsdoc";
import { env } from "./env";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Eventful API",
    version: "1.0.0",
    description:
      "Eventful — event ticketing platform API. Handles auth, events, tickets/QR codes, payments (Paystack), reminders and analytics.",
  },
  servers: [{ url: env.appUrl, description: "Current environment" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

export const swaggerSpec = swaggerJSDoc({
  swaggerDefinition,
  // JSDoc @swagger comments live directly above each route file
  apis: ["./src/modules/**/*.routes.ts"],
});
