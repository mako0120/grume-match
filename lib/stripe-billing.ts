// Monthly platform-fee invoices through Stripe Invoicing.
// Pure helpers (no network) so they run under node --test:
// - grouping pending fees into one invoice per Restaurant and month,
// - Stripe's form encoding,
// - webhook signature verification.

import { createHmac, timingSafeEqual } from "node:crypto";
import { feeTax } from "./pricing.ts";

export type PendingFee = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  fee: number;
  baseAmount: number;
  createdAt: string; // ISO
  creatorName: string;
  campaignTitle: string;
};

export type InvoicePlan = {
  restaurantId: string;
  restaurantName: string;
  period: string; // YYYY-MM (Asia/Tokyo)
  lines: { feeId: string; amount: number; description: string }[];
  subtotal: number;
  tax: number;
  total: number;
};

/** YYYY-MM of an instant in Asia/Tokyo. */
export function tokyoPeriod(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date(iso));
}

export function isPeriod(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** One invoice per Restaurant for the fees of `period`. Zero fees are skipped. */
export function planInvoices(fees: PendingFee[], period: string): InvoicePlan[] {
  const byRestaurant = new Map<string, InvoicePlan>();

  for (const fee of fees) {
    if (fee.fee <= 0 || tokyoPeriod(fee.createdAt) !== period) continue;
    const plan = byRestaurant.get(fee.restaurantId) ?? {
      restaurantId: fee.restaurantId,
      restaurantName: fee.restaurantName,
      period,
      lines: [],
      subtotal: 0,
      tax: 0,
      total: 0,
    };
    plan.lines.push({
      feeId: fee.id,
      amount: fee.fee,
      description: `PR手数料（${fee.creatorName}・${fee.campaignTitle}・報酬¥${fee.baseAmount.toLocaleString("ja-JP")}）`,
    });
    plan.subtotal += fee.fee;
    byRestaurant.set(fee.restaurantId, plan);
  }

  return [...byRestaurant.values()].map((plan) => {
    const tax = feeTax(plan.subtotal);
    return { ...plan, tax, total: plan.subtotal + tax };
  });
}

type FormValue = string | number | boolean | null | undefined | FormValue[] | { [key: string]: FormValue };

/** Stripe's application/x-www-form-urlencoded with nested keys: a[b][0]=c. */
export function encodeStripeForm(params: Record<string, FormValue>) {
  const pairs: string[] = [];

  function add(key: string, value: FormValue) {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => add(`${key}[${index}]`, item));
    } else if (typeof value === "object") {
      for (const [child, childValue] of Object.entries(value)) add(`${key}[${child}]`, childValue);
    } else {
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }

  for (const [key, value] of Object.entries(params)) add(key, value);
  return pairs.join("&");
}

/**
 * Verifies a `Stripe-Signature` header (t=…,v1=…) against the raw body.
 * Rejects signatures older than `toleranceSeconds` to stop replays.
 */
export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  options: { toleranceSeconds?: number; now?: number } = {},
) {
  if (!header || !secret) return false;

  const parts = header.split(",").map((part) => part.split("=", 2) as [string, string]);
  const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!Number.isFinite(timestamp) || !signatures.length) return false;

  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > (options.toleranceSeconds ?? 300)) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest();
  return signatures.some((signature) => {
    const given = Buffer.from(signature, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** Test/local helper: the header Stripe would send for this payload. */
export function signStripePayload(payload: string, secret: string, timestamp: number) {
  const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}
