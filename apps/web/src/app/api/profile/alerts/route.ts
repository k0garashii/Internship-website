import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentViewer } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const alertSettingsSchema = z.object({
  dailyDigestEnabled: z.boolean(),
});

export async function PATCH(request: Request) {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const parsed = alertSettingsSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid alert settings" }, { status: 400 });
  }

  const updated = await db.userProfile.updateMany({
    where: { userId: viewer.userId },
    data: { dailyDigestEnabled: parsed.data.dailyDigestEnabled },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Complète d’abord ton profil." }, { status: 409 });
  }

  return NextResponse.json(parsed.data);
}
