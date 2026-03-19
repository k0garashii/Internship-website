import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { UserConfigError, importUserConfig } from "@/lib/config/user-config";

export const runtime = "nodejs";

export async function POST(request: Request) {
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

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Invalid JSON payload",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const result = await importUserConfig(viewer, payload);

    return NextResponse.json(
      {
        importedAt: result.importedAt,
        sections: result.sections,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof UserConfigError) {
      return NextResponse.json(
        {
          error: error.message,
          fieldErrors: error.fieldErrors ?? {},
        },
        {
          status: error.status,
        },
      );
    }

    return NextResponse.json(
      {
        error: "Unable to import configuration",
      },
      {
        status: 500,
      },
    );
  }
}
