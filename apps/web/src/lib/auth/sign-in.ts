import { UserStatus } from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";
import { issueViewerSession } from "@/server/facades/auth-facade";

import { verifyPassword } from "./password";
import { type SessionContext } from "./session";

const signInUserSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(128),
});

export class SignInUserError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "SignInUserError";
  }
}

export async function signInUser(
  input: unknown,
  sessionContext: SessionContext = {},
) {
  const parsedInput = signInUserSchema.safeParse(input);

  if (!parsedInput.success) {
    throw new SignInUserError(
      "Invalid sign-in payload",
      400,
      parsedInput.error.flatten().fieldErrors,
    );
  }

  const { email, password } = parsedInput.data;
  const user = await db.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      passwordHash: true,
      status: true,
    },
  });

  if (!user?.passwordHash) {
    throw new SignInUserError("Invalid email or password", 401);
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new SignInUserError("This account is not active", 403);
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new SignInUserError("Invalid email or password", 401);
  }

  const result = await issueViewerSession({
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    sessionContext,
  });

  return {
    user: result.user,
    session: result.session,
  };
}
