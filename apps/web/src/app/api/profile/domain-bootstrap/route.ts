import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { exportUserConfig } from "@/lib/config/user-config";
import { generateDomainBootstrap } from "@/lib/domains/bootstrap";

export const runtime = "nodejs";

export async function POST() {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return NextResponse.json(
      {
        error: "Authentication required",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const config = await exportUserConfig(viewer);
    const suggestions = await generateDomainBootstrap(
      config.personalProfile,
      config.searchTargets,
    );

    return NextResponse.json(
      {
        provider: suggestions.provider,
        summary: suggestions.summary,
        domains: suggestions.domains,
        targetRoles: suggestions.targetRoles,
        locations: suggestions.locations,
        keywords: suggestions.keywords,
      },
      {
        status: 200,
      },
    );
  } catch {
    return NextResponse.json(
      {
        error: "Unable to generate a first domain base",
      },
      {
        status: 500,
      },
    );
  }
}
