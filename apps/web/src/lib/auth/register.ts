import { Prisma } from "@prisma/client";
import { z } from "zod";

import { buildRateLimitKey, enforceRateLimits } from "@/lib/security/rate-limit";
import { registerEmailPasswordUser } from "@/server/facades/auth-facade";

import { hashPassword } from "./password";
import { type SessionContext } from "./session";

const registerUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z
    .string()
    .min(10)
    .max(128)
    .regex(/[A-Za-z]/, "Password must include a letter")
    .regex(/\d/, "Password must include a number"),
});

const REGISTRATIONS_PER_IP = 10;
const REGISTRATION_WINDOW_MS = 60 * 60 * 1000;

export class RegisterUserError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "RegisterUserError";
  }
}

export async function registerUser(
  input: unknown,
  sessionContext: SessionContext = {},
) {
  const parsedInput = registerUserSchema.safeParse(input);

  if (!parsedInput.success) {
    throw new RegisterUserError(
      "Invalid registration payload",
      400,
      parsedInput.error.flatten().fieldErrors,
    );
  }

  const { fullName, email, password } = parsedInput.data;

  await enforceRateLimits([
    {
      key: buildRateLimitKey("register:ip", sessionContext.ipAddress ?? "unknown"),
      limit: REGISTRATIONS_PER_IP,
      windowMs: REGISTRATION_WINDOW_MS,
    },
  ]);

  const passwordHash = await hashPassword(password);

  try {
    const result = await registerEmailPasswordUser({
      email,
      fullName,
      passwordHash,
      sessionContext,
    });

    return {
      user: result.user,
      session: {
        token: result.session.token,
        expiresAt: result.session.expiresAt,
      },
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new RegisterUserError("An account already exists for this email", 409, {
        email: ["An account already exists for this email"],
      });
    }

    throw error;
  }
}
