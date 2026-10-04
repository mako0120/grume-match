import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { feeTax } from "../lib/pricing.ts";
import {
  encodeStripeForm,
  isPeriod,
  planInvoices,
  signStripePayload,
  tokyoPeriod,
  verifyStripeSignature,
} from "../lib/stripe-billing.ts";

const fee = (overrides) => ({
  id: "f1",
  restaurantId: "r1",
  restaurantName: "焼肉 ひまわり",
  fee: 2000,
  baseAmount: 8000,
  createdAt: "2026-10-03T10:00:00Z",
  creatorName: "グルメ日誌",
  campaignTitle: "厚切りタン PR",
  ...overrides,
});

test("consumption tax is 10%, rounded down once per invoice", () => {
  assert.equal(feeTax(10000), 1000);
  assert.equal(feeTax(2469), 246);
});

test("one invoice per Restaurant and Tokyo month; zero fees skipped", () => {
  const plans = planInvoices(
    [
      fee({ id: "a" }),
      fee({ id: "b", fee: 3000, baseAmount: 15000 }),
      fee({ id: "free", fee: 0 }),
      fee({ id: "c", restaurantId: "r2", restaurantName: "鮨 こはく" }),
      // 2026-10-31 23:30 JST is still October; 2026-11-01 00:30 JST is not.
      fee({ id: "late", createdAt: "2026-10-31T14:30:00Z" }),
      fee({ id: "next", createdAt: "2026-10-31T15:30:00Z" }),
    ],
    "2026-10",
  );

  assert.equal(plans.length, 2);
  const himawari = plans.find((plan) => plan.restaurantId === "r1");
  assert.deepEqual(himawari.lines.map((line) => line.feeId), ["a", "b", "late"]);
  assert.equal(himawari.subtotal, 7000);
  assert.equal(himawari.tax, 700);
  assert.equal(himawari.total, 7700);
  assert.match(himawari.lines[1].description, /グルメ日誌・厚切りタン PR・報酬¥15,000/);
  assert.equal(tokyoPeriod("2026-10-31T15:30:00Z"), "2026-11");
  assert.equal(isPeriod("2026-10"), true);
  assert.equal(isPeriod("2026-13"), false);
});

test("Stripe form encoding handles nested objects and arrays", () => {
  assert.equal(
    encodeStripeForm({
      customer: "cus_1",
      default_tax_rates: ["txr_1"],
      payment_settings: { payment_method_types: ["card", "customer_balance"] },
      metadata: { period: "2026-10" },
      skipped: undefined,
    }),
    [
      "customer=cus_1",
      "default_tax_rates%5B0%5D=txr_1",
      "payment_settings%5Bpayment_method_types%5D%5B0%5D=card",
      "payment_settings%5Bpayment_method_types%5D%5B1%5D=customer_balance",
      "metadata%5Bperiod%5D=2026-10",
    ].join("&"),
  );
});

test("webhook signatures are verified, fresh and constant-time compared", () => {
  const payload = JSON.stringify({ type: "invoice.paid" });
  const now = 1_790_000_000;
  const header = signStripePayload(payload, "whsec_test", now);

  assert.equal(verifyStripeSignature(payload, header, "whsec_test", { now }), true);
  assert.equal(verifyStripeSignature(payload + " ", header, "whsec_test", { now }), false);
  assert.equal(verifyStripeSignature(payload, header, "whsec_other", { now }), false);
  assert.equal(verifyStripeSignature(payload, header, "whsec_test", { now: now + 301 }), false);
  assert.equal(verifyStripeSignature(payload, null, "whsec_test", { now }), false);
  assert.equal(verifyStripeSignature(payload, "t=1,v1=zz", "whsec_test", { now }), false);
});

test("the webhook trusts nothing before the signature and only our invoices", async () => {
  const route = await readFile("app/api/stripe/webhook/route.ts", "utf8");
  assert.ok(route.indexOf("verifyStripeSignature") < route.indexOf("JSON.parse"));
  assert.match(route, /metadata\?\.source !== "gourmet-diary"/);

  const migration = await readFile("supabase/migrations/202610040001_stripe_invoices.sql", "utf8");
  // Invoices must match the pending fees exactly.
  assert.match(migration, /invoice_fees_mismatch/);
});
