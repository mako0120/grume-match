import { NextResponse, type NextRequest } from "next/server";
import { verifyStripeSignature } from "@/lib/stripe-billing";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const handled: Record<string, "paid" | "void"> = {
  "invoice.paid": "paid",
  "invoice.voided": "void",
};

// Stripe → app: platform-fee invoices paid or voided. The body is verified
// with STRIPE_WEBHOOK_SECRET before anything is read from it.
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new NextResponse(null, { status: 503 });

  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"), secret)) {
    return new NextResponse(null, { status: 400 });
  }

  let event: { type?: string; data?: { object?: { id?: string; metadata?: Record<string, string> } } };
  try {
    event = JSON.parse(payload);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const action = event.type ? handled[event.type] : undefined;
  const invoice = event.data?.object;
  // Only invoices this app created; acknowledge everything else.
  if (!action || !invoice?.id || invoice.metadata?.source !== "gourmet-diary") {
    return NextResponse.json({ received: true });
  }

  const { data, error } = await createAdminClient().rpc("apply_stripe_invoice_event", {
    p_stripe_invoice_id: invoice.id,
    p_event: action,
  });

  // A 500 makes Stripe retry; the database call is idempotent.
  if (error) return new NextResponse(null, { status: 500 });
  return NextResponse.json({ received: true, result: data });
}
