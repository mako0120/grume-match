import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripeDiaryWebhookVerified, stripeDiaryConfigured, type StripeInvoice } from "@/server/diary/stripe";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!stripeDiaryConfigured() || !process.env.DIARY_STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const raw = await request.text();
  if (!stripeDiaryWebhookVerified(raw, request.headers.get("stripe-signature")))
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  let event: { id: string; type: string; data: { object: StripeInvoice } };
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: "invalid_event" }, { status: 400 }); }
  if (!/^evt_[A-Za-z0-9]+$/.test(event.id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  if (!["invoice.paid", "invoice.voided", "invoice.marked_uncollectible"].includes(event.type)) {
    return NextResponse.json({ received: true });
  }
  const invoice = event.data?.object;
  if (!invoice?.id?.startsWith("in_") ||
      invoice.metadata?.diary_source !== "gurume_diary_direct" ||
      !invoice.metadata?.diary_inquiry_id) return NextResponse.json({ received: true });
  const admin = createAdminClient();
  const { data } = await admin.from("diary_pr_inquiries")
    .select("id,agreed_fee_yen,stripe_invoice_id,stripe_invoice_status")
    .eq("id", invoice.metadata.diary_inquiry_id)
    .eq("stripe_invoice_id", invoice.id).maybeSingle();
  if (!data || invoice.currency !== "jpy" || invoice.amount_due !== data.agreed_fee_yen)
    return NextResponse.json({ received: true });
  // Monotonic states: duplicates and late 'open' events cannot un-pay an invoice.
  const status = event.type === "invoice.paid" ? "paid"
    : event.type === "invoice.voided" ? "void" : "uncollectible";
  const allowed = status === "paid" ? ["draft", "open", "failed", "paid"] : ["draft", "open", "failed"];
  const now = new Date().toISOString();
  const { error } = await admin.from("diary_pr_inquiries")
    .update({ stripe_invoice_status: status, ...(status === "paid" ? { payment_received_at: now } : {}) })
    .eq("id", data.id).in("stripe_invoice_status", allowed);
  if (error) return NextResponse.json({ error: "db_error" }, { status: 503 });
  return NextResponse.json({ received: true });
}
