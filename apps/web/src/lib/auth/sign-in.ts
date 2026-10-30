import { UserStatus } from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";
import { buildRateLimitKey, enforceRateLimits } from "@/lib/security/rate-limit";
import { issueViewerSession } from "@/server/facades/auth-facade";

import { hashPassword, verifyPassword } from "./password";
import { type SessionContext } from "./session";

const signInUserSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(128),
});

const SIGN_IN_WINDOW_MS = 15 * 60 * 1000;
const SIGN_IN_ATTEMPTS_PER_IP = 30;
const SIGN_IN_ATTEMPTS_PER_EMAIL = 10;

let dummyPasswordHash: Promise<string> | null = null;

// Running scrypt even for unknown emails keeps the response time identical,
// so timing cannot reveal which emails have an account.
function getDummyPasswordHash() {
  dummyPasswordHash ??= hashPassword("dummy-password-for-timing-equalization");
  return dummyPasswordHash;
}

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

  await enforceRateLimits([
    {
      key: buildRateLimitKey("sign-in:ip", sessionContext.ipAddress ?? "unknown"),
      limit: SIGN_IN_ATTEMPTS_PER_IP,
      windowMs: SIGN_IN_WINDOW_MS,
    },
    {
      key: buildRateLimitKey("sign-in:email", email),
      limit: SIGN_IN_ATTEMPTS_PER_EMAIL,
      windowMs: SIGN_IN_WINDOW_MS,
    },
  ]);

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

  const isPasswordValid = await verifyPassword(
    password,
    user?.passwordHash ?? (await getDummyPasswordHash()),
  );

  if (!user?.passwordHash || !isPasswordValid) {
    throw new SignInUserError("Invalid email or password", 401);
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new SignInUserError("This account is not active", 403);
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
