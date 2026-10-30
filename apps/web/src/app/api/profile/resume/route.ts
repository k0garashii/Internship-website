import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { logRouteError } from "@/lib/observability/error-logging";
import {
  deleteResumeForUser,
  importResumeForUser,
  ResumeImportError,
} from "@/lib/profile/resume-import";
import {
  buildRateLimitKey,
  buildRateLimitResponseInit,
  enforceRateLimits,
  RateLimitExceededError,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let file: FormDataEntryValue | null = null;

  try {
    file = (await request.formData()).get("resume");
  } catch {
    file = null;
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Ajoute un fichier PDF." }, { status: 400 });
  }

  try {
    await enforceRateLimits([
      {
        key: buildRateLimitKey("resume-import:user", viewer.userId),
        limit: 10,
        windowMs: 60 * 60 * 1000,
      },
    ]);

    return NextResponse.json(await importResumeForUser(viewer.userId, file));
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: "Trop d’imports de CV. Réessaie plus tard." },
        buildRateLimitResponseInit(error),
      );
    }

    if (error instanceof ResumeImportError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    logRouteError({
      route: "/api/profile/resume",
      request,
      message: "Resume import failed",
      error,
      status: 500,
      metadata: { userId: viewer.userId },
    });

    return NextResponse.json({ error: "Impossible d’importer le CV." }, { status: 500 });
  }
}

export async function DELETE() {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  await deleteResumeForUser(viewer.userId);

  return NextResponse.json({ deleted: true });
}
