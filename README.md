# Eventful API

Node.js + TypeScript event ticketing platform, built with a layered
**Route → Controller → Service → Prisma(DB)** architecture (SBC), Redis caching,
QR-coded tickets, Paystack payments, flexible reminders, and creator analytics.

## Stack
- Express + TypeScript
- PostgreSQL via Prisma ORM
- Redis (cache-aside layer, `src/utils/cache.ts`)
- JWT auth, Zod validation, express-rate-limit
- Paystack (payments), `qrcode` (QR generation), `node-cron` (reminders)
- Swagger/OpenAPI at `/api-docs`
- Jest + Supertest

## Project layout
```
src/
  config/        env, prisma client, redis client, swagger spec
  middlewares/    auth, role guard, validation, rate limiting, error handler
  modules/
    auth/         register/login
    events/       CRUD + share links
    tickets/      QR generation/verification, attendee lists
    payments/     Paystack init/verify/webhook
    notifications/ reminders + cron scheduler
    analytics/     creator stats
  utils/          logger, jwt, hash, cache, ApiError
  app.ts          express app + route wiring
  server.ts       entrypoint
prisma/schema.prisma   full data model
tests/                 jest unit + integration tests
docker-compose.yml     local Postgres + Redis
```

## Setup
1. `cp .env.example .env` and fill in real values (JWT secret, Paystack test keys).
2. `docker-compose up -d` — starts Postgres and Redis.
3. `npm install`
4. `npx prisma migrate dev --name init` — creates tables from `prisma/schema.prisma`.
5. `npm run dev` — starts the API on `http://localhost:4000`.
6. Open `http://localhost:4000/api-docs` for the Swagger UI.

## Testing
`npm test` — runs unit tests (QR sign/verify) and integration tests (auth routes)
with Prisma/Redis mocked so no live DB is required.

## Paystack webhook (local dev)
Use a tunnel (e.g. `ngrok http 4000`) and set the forwarded URL +
`/api/payments/webhook` as your webhook URL in the Paystack dashboard.

## Notes / where to extend
- `notifications.service.ts` logs reminders instead of sending real email/SMS —
  swap in SendGrid/Twilio/FCM there.
- `cacheAside()` in `utils/cache.ts` is the generic caching layer; event listings
  and analytics already use it and invalidate on writes.
- Ticket `status` flow: `PENDING → PAID → SCANNED` (or `CANCELLED`).
