import { UserStatus } from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";

import { verifyPassword } from "./password";
import { prepareAuthSession, type SessionContext } from "./session";

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

  await db.authSession.deleteMany({
    where: {
      userId: user.id,
      expiresAt: {
        lte: new Date(),
      },
    },
  });

  const session = prepareAuthSession(user.id, sessionContext);

  await db.authSession.create({
    data: session.record,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
    },
    session: {
      token: session.token,
      expiresAt: session.expiresAt,
    },
  };
}
