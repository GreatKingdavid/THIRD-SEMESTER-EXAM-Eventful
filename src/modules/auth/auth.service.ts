import { prisma } from "../../config/db";
import { hashPassword, comparePassword } from "../../utils/hash";
import { signToken } from "../../utils/jwt";
import { ApiError } from "../../utils/apiError";

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: "CREATOR" | "EVENTEE";
}

interface LoginInput {
  email: string;
  password: string;
}

export class AuthService {
  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw ApiError.conflict("Email already in use");

    const hashed = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: hashed,
        role: input.role,
      },
    });

    const token = signToken({ userId: user.id, role: user.role });
    return { token, user: this.sanitize(user) };
  }

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw ApiError.unauthorized("Invalid credentials");

    const valid = await comparePassword(input.password, user.password);
    if (!valid) throw ApiError.unauthorized("Invalid credentials");

    const token = signToken({ userId: user.id, role: user.role });
    return { token, user: this.sanitize(user) };
  }

  private sanitize(user: { password: string; [key: string]: unknown }) {
    const { password, ...rest } = user;
    return rest;
  }
}

export const authService = new AuthService();
