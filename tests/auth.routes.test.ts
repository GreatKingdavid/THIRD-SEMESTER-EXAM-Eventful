import request from "supertest";

// Mock the Prisma-backed DB layer so this test doesn't need a real database.
jest.mock("../src/config/db", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Mock redis so rate limiting / cache helpers don't try to open a real connection.
jest.mock("../src/config/redis", () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
    on: jest.fn(),
  },
}));

import { prisma } from "../src/config/db";
import { app } from "../src/app";

describe("POST /api/auth/register", () => {
  it("registers a new user and returns a token", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
    (prisma.user.create as jest.Mock).mockResolvedValueOnce({
      id: "u1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "hashed",
      role: "EVENTEE",
    });

    const res = await request(app).post("/api/auth/register").send({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "supersecret",
      role: "EVENTEE",
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe("ada@example.com");
    expect(res.body.user.password).toBeUndefined();
  });

  it("rejects invalid input with 400", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "A",
      email: "not-an-email",
      password: "123",
      role: "EVENTEE",
    });

    expect(res.status).toBe(400);
  });

  it("rejects duplicate emails with 409", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: "existing" });

    const res = await request(app).post("/api/auth/register").send({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "supersecret",
      role: "EVENTEE",
    });

    expect(res.status).toBe(409);
  });
});
