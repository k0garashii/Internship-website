import { NextResponse } from "next/server";

import { getStripeConfig, StripeWebhookError, verifyStripeWebhook } from "@/lib/billing/stripe";
import { logRouteError } from "@/lib/observability/error-logging";
import { handleStripeEvent } from "@/server/application/billing/stripe-billing-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const config = getStripeConfig();

  if (!config?.webhookSecret) {
    return NextResponse.json({ error: "Stripe webhooks are not configured" }, { status: 503 });
  }

  // The signature covers the exact raw body, so it is read as text before parsing.
  const rawBody = await request.text();
  let event;

  try {
    event = verifyStripeWebhook(rawBody, request.headers.get("stripe-signature"), config.webhookSecret);
  } catch (error) {
    if (error instanceof StripeWebhookError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  try {
    const result = await handleStripeEvent(config, event);

    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    // A 5xx makes Stripe retry the delivery later.
    logRouteError({
      route: "/api/billing/stripe/webhook",
      request,
      message: "Stripe webhook handling failed",
      error,
      status: 500,
      metadata: { eventId: event.id, eventType: event.type },
    });

    return NextResponse.json({ error: "Webhook handling failed" }, { status: 500 });
  }
}
