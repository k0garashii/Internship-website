import { NextResponse } from "next/server";

import { getCurrentViewer } from "@/lib/auth/session";
import { StripeRequestError } from "@/lib/billing/stripe";
import { getRequestBaseUrl } from "@/lib/http/request-origin";
import { logRouteError } from "@/lib/observability/error-logging";
import { BillingError, openBillingPortal } from "@/server/application/billing/stripe-billing-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    return NextResponse.json(await openBillingPortal(viewer, getRequestBaseUrl(request)));
  } catch (error) {
    if (error instanceof BillingError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    logRouteError({
      route: "/api/billing/portal",
      request,
      message: "Stripe billing portal session creation failed",
      error,
      status: error instanceof StripeRequestError ? 502 : 500,
      metadata: { userId: viewer.userId },
    });

    return NextResponse.json(
      { error: "Impossible d’ouvrir l’espace de gestion. Réessaie dans un instant." },
      { status: 502 },
    );
  }
}
