import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const ROOT = "https://api.stripe.com/v1";

export function stripeDiaryConfigured(): boolean {
  // Deliberate standalone credentials. NEVER reuse BASE/eBay Stripe keys.
  return process.env.DIARY_STRIPE_ENABLED === "true" &&
    !!process.env.DIARY_STRIPE_SECRET_KEY?.startsWith("sk_") &&
    !!process.env.DIARY_STRIPE_ACCOUNT_ID?.startsWith("acct_");
}

type StripeCallOptions = {
  method?: "GET" | "POST";
  body?: URLSearchParams;
  idempotencyKey?: string;
};
export async function diaryStripeApi<T>(path: string, options: StripeCallOptions = {}): Promise<T> {
  if (!stripeDiaryConfigured()) throw new Error("Dedicated Diary Stripe account is disabled or missing");
  if (!path.startsWith("/") || path.includes("://")) throw new Error("Invalid Stripe path");
  const key = process.env.DIARY_STRIPE_SECRET_KEY!;
  const headers: Record<string, string> = { Authorization: "Bearer " + key };
  if (options.body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  const response = await fetch(ROOT + path, {
    method: options.method ?? "GET",
    headers,
    body: options.body?.toString(),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error("Stripe request failed (" + response.status + ")");
  return JSON.parse(text) as T;
}

export type StripeCustomer = { id: string };
export type StripeInvoice = {
  id: string;
  status: string;
  amount_due: number;
  currency: string;
  customer: string | null;
  metadata?: Record<string, string>;
  hosted_invoice_url?: string | null;
  invoice_pdf?: string | null;
  created?: number;
};

export function stripeDiaryWebhookVerified(payload: string, signature: string | null): boolean {
  const secret = process.env.DIARY_STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature || !payload || payload.length > 100_000) return false;
  const parts = signature.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const v1 = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!timestamp || !/^\d+$/.test(timestamp) || v1.length === 0) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret).update(timestamp + "." + payload).digest("hex");
  const a = Buffer.from(expected, "hex");
  return v1.some((provided) => {
    if (!/^[0-9a-f]{64}$/i.test(provided)) return false;
    return timingSafeEqual(a, Buffer.from(provided, "hex"));
  });
}
