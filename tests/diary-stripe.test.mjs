import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
test("billing disabled by default and isolated dedicated Stripe account", () => {
  const env = read(".env.example");
  const stripe = read("server/diary/stripe.ts");
  assert.match(env, /DIARY_STRIPE_ENABLED=false/);
  assert.match(env, /DIARY_STRIPE_ACCOUNT_ID=/);
  assert.match(stripe, /account.id !== process.env.DIARY_STRIPE_ACCOUNT_ID/);
});
test("booking creates draft, publishes only after Instagram post and uses 7 days", () => {
  const booking = read("app/diary/confirm/[token]/actions.ts");
  const admin = read("app/admin/diary-inquiries/actions.ts");
  const logic = read("server/diary/invoicing.ts");
  assert.match(booking, /createDiaryDraftInvoice/);
  assert.match(admin, /sendPublishedDiaryInvoice/);
  assert.match(logic, /collection_method: "send_invoice"/);
  assert.match(logic, /auto_advance: false/);
  assert.match(logic, /days_until_due: 7/);
  assert.match(logic, /"\/invoices\/" \+ encodeURIComponent\(invoiceId\) \+ "\/send"/);
  assert.match(logic, /invoice.amount_due !== data.agreed_fee_yen/);
  assert.match(logic, /idempotencyKey: "diary-invoice-"/);
});
test("webhook uses authenticated Stripe signatures, invoice IDs and amount before marking paid", () => {
  const api = read("app/api/diary/stripe/webhook/route.ts");
  const stripe = read("server/diary/stripe.ts");
  assert.match(api, /stripeDiaryWebhookVerified/);
  assert.match(api, /invoice\.paid/);
  assert.match(api, /invoice\.amount_due !== data\.agreed_fee_yen/);
  assert.match(stripe, /timingSafeEqual/);
  assert.match(stripe, /Math\.abs\(now - Number\(timestamp\)\) > 300/);
});
test("brief collects creator emphasis, featured menu and desired campaign outcomes", () => {
  const form = read("app/diary/components/inquiry-form.tsx");
  const schema = read("lib/diary/inquiry.ts");
  assert.match(form, /特に伝えてほしいポイント/);
  assert.match(form, /紹介希望メニュー/);
  assert.match(form, /PRの目的/);
  assert.match(schema, /desired_coverage/);
});
