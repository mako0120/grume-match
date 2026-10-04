#!/usr/bin/env node
// Monthly platform-fee invoices through Stripe Invoicing (経理).
// See docs/BILLING.md.
//
//   node scripts/billing.mjs preview YYYY-MM      what would be invoiced (no Stripe calls)
//   node scripts/billing.mjs send YYYY-MM --yes   create, finalize and email the invoices
//   node scripts/billing.mjs setup-tax            create the 10% JP consumption tax rate once
//
// Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and, for send /
// setup-tax, STRIPE_SECRET_KEY (+ STRIPE_TAX_RATE_ID for send).
// Optional: INVOICE_REGISTRATION_NUMBER (T + 13 digits) printed on invoices,
// STRIPE_API_BASE for a local fake. Never commit these values.
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { PLATFORM_FEE_TAX_RATE } from "../lib/pricing.ts";
import { stripeRequest } from "../lib/stripe-api.ts";
import { isPeriod, planInvoices } from "../lib/stripe-billing.ts";

function one(value) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function yen(value) {
  return `¥${Number(value).toLocaleString("ja-JP")}`;
}

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY first.");
    process.exit(2);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function stripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error("Set STRIPE_SECRET_KEY first (use a test key sk_test_… until billing is live).");
    process.exit(2);
  }
  return { secretKey, apiBase: process.env.STRIPE_API_BASE };
}

async function loadPlans(db, period) {
  const { data, error } = await db
    .from("platform_fees")
    .select(
      "id,restaurant_id,fee,base_amount,created_at,restaurants(name,billing_email,stripe_customer_id),bookings(creator_profiles(display_name),campaigns(title))",
    )
    .eq("status", "pending")
    .is("invoice_id", null)
    .gt("fee", 0)
    .order("created_at")
    .limit(2000);
  if (error) throw error;

  const restaurants = new Map();
  const fees = data.map((row) => {
    const restaurant = one(row.restaurants);
    const booking = one(row.bookings);
    restaurants.set(row.restaurant_id, restaurant);
    return {
      id: row.id,
      restaurantId: row.restaurant_id,
      restaurantName: restaurant?.name ?? "店舗",
      fee: row.fee,
      baseAmount: row.base_amount,
      createdAt: row.created_at,
      creatorName: one(booking?.creator_profiles)?.display_name ?? "Creator",
      campaignTitle: one(booking?.campaigns)?.title ?? "PR案件",
    };
  });

  return planInvoices(fees, period).map((plan) => ({ ...plan, restaurant: restaurants.get(plan.restaurantId) }));
}

function printPlan(plan) {
  console.log(`${plan.restaurantName}  ${plan.period}  → ${plan.restaurant?.billing_email ?? "(請求先メール未設定)"}`);
  for (const line of plan.lines) console.log(`  ${yen(line.amount).padStart(8)}  ${line.description}`);
  console.log(`  小計 ${yen(plan.subtotal)} ＋ 消費税${PLATFORM_FEE_TAX_RATE * 100}% ${yen(plan.tax)} ＝ ${yen(plan.total)}（見込み）\n`);
}

async function preview(period) {
  const plans = await loadPlans(supabase(), period);
  if (!plans.length) {
    console.log(`No pending fees for ${period}.`);
    return;
  }
  plans.forEach(printPlan);
  const missing = plans.filter((plan) => !plan.restaurant?.billing_email);
  if (missing.length) {
    console.log(`請求先メール未設定: ${missing.map((plan) => plan.restaurantName).join("、")}（店舗の「ご請求」ページで登録してもらう）`);
  }
}

async function checkTaxRate(config) {
  const id = process.env.STRIPE_TAX_RATE_ID;
  if (!id) {
    console.error("Set STRIPE_TAX_RATE_ID (run `npm run billing -- setup-tax` once).");
    process.exit(2);
  }
  const rate = await stripeRequest(config, "GET", `/v1/tax_rates/${id}`);
  if (Number(rate.percentage) !== PLATFORM_FEE_TAX_RATE * 100 || rate.inclusive !== false || rate.active === false) {
    console.error(`Tax rate ${id} must be an active, exclusive ${PLATFORM_FEE_TAX_RATE * 100}% rate.`);
    process.exit(2);
  }
  return id;
}

async function ensureCustomer(db, config, plan) {
  if (plan.restaurant?.stripe_customer_id) return plan.restaurant.stripe_customer_id;
  const customer = await stripeRequest(
    config,
    "POST",
    "/v1/customers",
    {
      name: plan.restaurantName,
      email: plan.restaurant.billing_email,
      preferred_locales: ["ja"],
      metadata: { restaurant_id: plan.restaurantId, source: "gourmet-diary" },
    },
    { idempotencyKey: `customer-${plan.restaurantId}` },
  );
  const { error } = await db.rpc("set_restaurant_stripe_customer", {
    p_restaurant_id: plan.restaurantId,
    p_customer_id: customer.id,
  });
  if (error) throw error;
  return customer.id;
}

async function sendOne(db, config, taxRateId, plan) {
  const customerId = await ensureCustomer(db, config, plan);
  // Same fees → same key, so a retried run never creates a second invoice.
  const key = createHash("sha256")
    .update(plan.lines.map((line) => line.feeId).sort().join(","))
    .digest("hex")
    .slice(0, 24);
  const registration = process.env.INVOICE_REGISTRATION_NUMBER;

  const invoice = await stripeRequest(
    config,
    "POST",
    "/v1/invoices",
    {
      customer: customerId,
      currency: "jpy",
      collection_method: "send_invoice",
      days_until_due: 14,
      auto_advance: false,
      pending_invoice_items_behavior: "exclude",
      description: `GOURMET DIARY PR手数料（${plan.period}完了分）`,
      default_tax_rates: [taxRateId],
      custom_fields: registration ? [{ name: "登録番号", value: registration }] : undefined,
      payment_settings: {
        payment_method_types: ["card", "customer_balance"],
        payment_method_options: {
          customer_balance: { funding_type: "bank_transfer", bank_transfer: { type: "jp_bank_transfer" } },
        },
      },
      metadata: { restaurant_id: plan.restaurantId, period: plan.period, source: "gourmet-diary" },
    },
    { idempotencyKey: `invoice-${plan.restaurantId}-${plan.period}-${key}` },
  );

  for (const line of plan.lines) {
    await stripeRequest(
      config,
      "POST",
      "/v1/invoiceitems",
      {
        customer: customerId,
        invoice: invoice.id,
        currency: "jpy",
        amount: line.amount,
        description: line.description,
        metadata: { fee_id: line.feeId },
      },
      { idempotencyKey: `item-${line.feeId}-${invoice.id}` },
    );
  }

  const finalized = await stripeRequest(config, "POST", `/v1/invoices/${invoice.id}/finalize`, {}, {
    idempotencyKey: `finalize-${invoice.id}`,
  });

  // Never send something that differs from what the app says is owed.
  const subtotal = Number(finalized.subtotal);
  const total = Number(finalized.total);
  if (subtotal !== plan.subtotal) {
    await stripeRequest(config, "POST", `/v1/invoices/${invoice.id}/void`);
    throw new Error(`Stripe subtotal ${subtotal} ≠ ${plan.subtotal}; invoice ${invoice.id} voided.`);
  }

  const { error } = await db.rpc("record_platform_invoice", {
    p_restaurant_id: plan.restaurantId,
    p_period: plan.period,
    p_fee_ids: plan.lines.map((line) => line.feeId),
    p_stripe_invoice_id: invoice.id,
    p_hosted_invoice_url: finalized.hosted_invoice_url ?? null,
    p_subtotal: subtotal,
    p_tax: total - subtotal,
  });
  if (error) {
    await stripeRequest(config, "POST", `/v1/invoices/${invoice.id}/void`);
    throw new Error(`Could not record ${invoice.id} (${error.message}); voided it in Stripe.`);
  }

  await stripeRequest(config, "POST", `/v1/invoices/${invoice.id}/send`, {}, { idempotencyKey: `send-${invoice.id}` });
  console.log(`Sent ${invoice.id} to ${plan.restaurantName}: ${yen(total)}`);
}

async function send(period, flags) {
  const db = supabase();
  const plans = await loadPlans(db, period);
  if (!plans.length) {
    console.log(`No pending fees for ${period}.`);
    return;
  }
  plans.forEach(printPlan);

  const ready = plans.filter((plan) => plan.restaurant?.billing_email);
  const skipped = plans.filter((plan) => !plan.restaurant?.billing_email);
  if (skipped.length) {
    console.log(`Skipping (no billing email): ${skipped.map((plan) => plan.restaurantName).join("、")}`);
  }
  if (!flags.yes) {
    console.log(`\nPreview only. Re-run with --yes to send ${ready.length} invoice(s).`);
    return;
  }

  const config = stripe();
  const taxRateId = await checkTaxRate(config);
  let failed = 0;
  for (const plan of ready) {
    try {
      await sendOne(db, config, taxRateId, plan);
    } catch (error) {
      failed += 1;
      console.error(`FAILED ${plan.restaurantName}: ${error.message}`);
    }
  }
  if (failed) process.exit(1);
}

async function setupTax() {
  const rate = await stripeRequest(stripe(), "POST", "/v1/tax_rates", {
    display_name: "消費税",
    percentage: PLATFORM_FEE_TAX_RATE * 100,
    inclusive: false,
    country: "JP",
    jurisdiction: "JP",
    description: "Japanese consumption tax (standard rate)",
  });
  console.log(`Created ${rate.id}. Set STRIPE_TAX_RATE_ID=${rate.id} in the environment.`);
}

const [command, period, ...rest] = process.argv.slice(2);
const flags = { yes: rest.includes("--yes") || period === "--yes" };

try {
  if (command === "setup-tax") await setupTax();
  else if ((command === "preview" || command === "send") && isPeriod(period ?? "")) {
    if (command === "preview") await preview(period);
    else await send(period, flags);
  } else {
    console.log("usage: billing.mjs preview YYYY-MM | send YYYY-MM [--yes] | setup-tax");
    process.exit(command ? 1 : 0);
  }
} catch (error) {
  console.error(error.message ?? error);
  process.exit(1);
}
