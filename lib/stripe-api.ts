// Minimal Stripe REST client (no SDK dependency). Used by the billing
// script; the secret key never reaches the browser.
// STRIPE_API_BASE can point at a local fake for testing.

import { encodeStripeForm } from "./stripe-billing.ts";

export type StripeConfig = {
  secretKey: string;
  apiBase?: string;
};

export class StripeError extends Error {
  status: number;
  code: string | undefined;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function stripeRequest<T = Record<string, unknown>>(
  config: StripeConfig,
  method: "GET" | "POST",
  path: string,
  params: Parameters<typeof encodeStripeForm>[0] = {},
  options: { idempotencyKey?: string } = {},
): Promise<T> {
  const base = (config.apiBase ?? "https://api.stripe.com").replace(/\/+$/, "");
  const body = encodeStripeForm(params);
  const url = method === "GET" && body ? `${base}${path}?${body}` : `${base}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
    },
    body: method === "POST" ? body : undefined,
  });

  const json = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; code?: string };
  } & T;

  if (!response.ok) {
    throw new StripeError(json.error?.message ?? `Stripe ${response.status}`, response.status, json.error?.code);
  }
  return json;
}
