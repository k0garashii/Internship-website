import { createHmac } from "node:crypto";

import { safeEqualStrings } from "@/lib/security/secrets";

const STRIPE_API_BASE_URL = "https://api.stripe.com/v1";
const STRIPE_REQUEST_TIMEOUT_MS = 15000;
const WEBHOOK_TOLERANCE_SECONDS = 300;

export type StripeConfig = {
  secretKey: string;
  webhookSecret: string | null;
  proPriceId: string;
};

export type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_start?: number;
  current_period_end?: number;
  metadata?: Record<string, string>;
  items?: {
    data?: Array<{
      current_period_start?: number;
      current_period_end?: number;
      price?: { id: string };
    }>;
  };
};

export type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

export class StripeRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StripeRequestError";
  }
}

export class StripeWebhookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeWebhookError";
  }
}

export function getStripeConfig(): StripeConfig | null {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const proPriceId = process.env.STRIPE_PRICE_PRO_MONTHLY?.trim();

  if (!secretKey || !proPriceId) {
    return null;
  }

  return {
    secretKey,
    proPriceId,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || null,
  };
}

async function stripeRequest<T>(
  config: StripeConfig,
  path: string,
  options: { method?: "GET" | "POST" | "DELETE"; params?: Record<string, string | undefined> } = {},
): Promise<T> {
  const method = options.method ?? "POST";
  const body = new URLSearchParams();

  for (const [key, value] of Object.entries(options.params ?? {})) {
    if (value !== undefined) {
      body.set(key, value);
    }
  }

  const response = await fetch(`${STRIPE_API_BASE_URL}${path}`, {
    method,
    signal: AbortSignal.timeout(STRIPE_REQUEST_TIMEOUT_MS),
    headers: {
      authorization: `Bearer ${config.secretKey}`,
      ...(method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" ? body : undefined,
  });
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: { message?: string } })
    | null;

  if (!response.ok || !payload) {
    throw new StripeRequestError(
      payload?.error?.message ?? `Stripe request failed with status ${response.status}`,
      response.status,
    );
  }

  return payload;
}

export async function createStripeCheckoutSession(
  config: StripeConfig,
  input: {
    workspaceId: string;
    customerId: string | null;
    customerEmail: string;
    successUrl: string;
    cancelUrl: string;
  },
) {
  return stripeRequest<{ id: string; url: string }>(config, "/checkout/sessions", {
    params: {
      mode: "subscription",
      "line_items[0][price]": config.proPriceId,
      "line_items[0][quantity]": "1",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.workspaceId,
      "metadata[workspaceId]": input.workspaceId,
      "subscription_data[metadata][workspaceId]": input.workspaceId,
      allow_promotion_codes: "true",
      locale: "fr",
      ...(input.customerId
        ? { customer: input.customerId }
        : input.customerEmail
          ? { customer_email: input.customerEmail }
          : {}),
    },
  });
}

export async function createStripePortalSession(
  config: StripeConfig,
  input: { customerId: string; returnUrl: string },
) {
  return stripeRequest<{ url: string }>(config, "/billing_portal/sessions", {
    params: { customer: input.customerId, return_url: input.returnUrl },
  });
}

export async function retrieveStripeSubscription(config: StripeConfig, subscriptionId: string) {
  return stripeRequest<StripeSubscription>(
    config,
    `/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { method: "GET" },
  );
}

export async function cancelStripeSubscription(config: StripeConfig, subscriptionId: string) {
  return stripeRequest<StripeSubscription>(
    config,
    `/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { method: "DELETE" },
  );
}

// Same algorithm as Stripe's SDKs: HMAC-SHA256 of "<timestamp>.<raw body>"
// with the endpoint secret, compared to every v1 signature in the header.
export function verifyStripeWebhook(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): StripeEvent {
  if (!signatureHeader) {
    throw new StripeWebhookError("Missing Stripe-Signature header");
  }

  const parts = signatureHeader.split(",").map((part) => part.trim().split("="));
  const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value ?? "");

  if (!Number.isFinite(timestamp) || signatures.length === 0) {
    throw new StripeWebhookError("Malformed Stripe-Signature header");
  }

  if (Math.abs(nowSeconds - timestamp) > WEBHOOK_TOLERANCE_SECONDS) {
    throw new StripeWebhookError("Stripe webhook timestamp outside the tolerance window");
  }

  const expected = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  if (!signatures.some((signature) => safeEqualStrings(signature, expected))) {
    throw new StripeWebhookError("Invalid Stripe webhook signature");
  }

  return JSON.parse(rawBody) as StripeEvent;
}

// Recent API versions moved the billing period from the subscription to its items.
export function readSubscriptionPeriodEnd(subscription: StripeSubscription) {
  const seconds = subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end;

  return typeof seconds === "number" ? new Date(seconds * 1000) : null;
}

export function readSubscriptionPeriodStart(subscription: StripeSubscription) {
  const seconds =
    subscription.current_period_start ?? subscription.items?.data?.[0]?.current_period_start;

  return typeof seconds === "number" ? new Date(seconds * 1000) : null;
}
