import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { diaryStripeApi, stripeDiaryConfigured, type StripeCustomer, type StripeInvoice } from "@/server/diary/stripe";

type DiaryInvoiceRow = {
  id: string; status: string; compliance_status: string; inquiry_kind: string;
  restaurant_name: string; contact_name: string; email: string;
  service: string; agreed_fee_yen: number; proposed_deliverables: string;
  published_at: string | null; stripe_customer_id: string | null;
  stripe_invoice_id: string | null; stripe_invoice_status: string;
};

function params(data: Record<string, string | number | boolean>): URLSearchParams {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) p.set(key, String(value));
  return p;
}

export async function createDiaryDraftInvoice(inquiryId: string): Promise<boolean> {
  if (!stripeDiaryConfigured()) return false;
  const admin = createAdminClient();
  const { data, error } = await admin.from("diary_pr_inquiries")
    .select("id,status,compliance_status,inquiry_kind,restaurant_name,contact_name,email,service,agreed_fee_yen,proposed_deliverables,published_at,stripe_customer_id,stripe_invoice_id,stripe_invoice_status")
    .eq("id", inquiryId).maybeSingle();
  if (error || !data || data.status !== "booked" || data.compliance_status !== "approved" ||
      data.inquiry_kind !== "application" || !data.agreed_fee_yen ||
      !data.proposed_deliverables || data.stripe_invoice_id) return false;
  const item = data as DiaryInvoiceRow;

  try {
    let customerId = item.stripe_customer_id;
    if (!customerId) {
      const customer = await diaryStripeApi<StripeCustomer>("/customers", {
        method: "POST",
        idempotencyKey: "diary-customer-" + item.id,
        body: params({
          name: item.restaurant_name,
          email: item.email,
          description: "グルメ日誌｜大阪 PR案件 " + item.id,
          "metadata[diary_inquiry_id]": item.id,
          "metadata[brand_contact]": item.contact_name,
        }),
      });
      customerId = customer.id;
      await admin.from("diary_pr_inquiries").update({ stripe_customer_id: customerId })
        .eq("id", item.id).is("stripe_customer_id", null);
    }

    // Explicit invoice association avoids accidentally importing unrelated pending items.
    const invoice = await diaryStripeApi<StripeInvoice>("/invoices", {
      method: "POST",
      idempotencyKey: "diary-invoice-" + item.id,
      body: params({
        customer: customerId,
        collection_method: "send_invoice",
        auto_advance: false,
        days_until_due: 7,
        currency: "jpy",
        "metadata[diary_inquiry_id]": item.id,
        "metadata[diary_source]": "gurume_diary_direct",
        description: "グルメ日誌｜大阪 直接PR制作",
        pending_invoice_items_behavior: "exclude",
      }),
    });
    if (invoice.status !== "draft" || invoice.currency !== "jpy") throw new Error("Unexpected invoice status");
    await diaryStripeApi("/invoiceitems", {
      method: "POST",
      idempotencyKey: "diary-line-" + item.id,
      body: params({
        customer: customerId,
        invoice: invoice.id,
        currency: "jpy",
        amount: item.agreed_fee_yen,
        description: "グルメ日誌｜大阪 PR制作：" + item.proposed_deliverables.slice(0, 400),
        "metadata[diary_inquiry_id]": item.id,
      }),
    });
    const updated = await admin.from("diary_pr_inquiries").update({
      stripe_customer_id: customerId, stripe_invoice_id: invoice.id,
      stripe_invoice_status: "draft", stripe_invoice_error: null,
      invoice_issued_at: new Date().toISOString(),
    }).eq("id", item.id).is("stripe_invoice_id", null).select("id").maybeSingle();
    return !!updated.data && !updated.error;
  } catch {
    await admin.from("diary_pr_inquiries").update({
      stripe_invoice_status: "failed",
      stripe_invoice_error: "Draft generation failed; retry will resume using idempotency keys.",
      stripe_invoice_last_attempt_at: new Date().toISOString(),
    }).eq("id", item.id).is("stripe_invoice_id", null);
    return false;
  }
}

export async function sendPublishedDiaryInvoice(inquiryId: string): Promise<boolean> {
  if (!stripeDiaryConfigured()) return false;
  const admin = createAdminClient();
  const { data } = await admin.from("diary_pr_inquiries")
    .select("id,status,published_at,payment_terms,stripe_invoice_id,stripe_invoice_status,agreed_fee_yen")
    .eq("id", inquiryId).maybeSingle();
  if (!data || data.status !== "booked" || !data.published_at ||
      data.payment_terms !== "after_publish_7d" || !data.stripe_invoice_id ||
      !["draft", "failed"].includes(data.stripe_invoice_status)) return false;

  try {
    const invoiceId = data.stripe_invoice_id;
    let invoice = await diaryStripeApi<StripeInvoice>("/invoices/" + encodeURIComponent(invoiceId));
    // Check the exact total and currency before finalizing; refuse to bill on mismatch.
    if (invoice.currency !== "jpy" || invoice.amount_due !== data.agreed_fee_yen ||
        invoice.metadata?.diary_inquiry_id !== data.id) throw new Error("Invoice amount or source mismatch");
    if (invoice.status === "draft") invoice = await diaryStripeApi<StripeInvoice>(
      "/invoices/" + encodeURIComponent(invoiceId) + "/finalize", {
        method: "POST", idempotencyKey: "diary-finalize-" + data.id,
        body: params({ auto_advance: false }),
      });
    if (invoice.status !== "open" && invoice.status !== "paid") throw new Error("Invoice not open");
    if (invoice.status === "open") invoice = await diaryStripeApi<StripeInvoice>(
      "/invoices/" + encodeURIComponent(invoiceId) + "/send", {
        method: "POST", idempotencyKey: "diary-send-" + data.id, body: params({}),
      });
    await admin.from("diary_pr_inquiries").update({
      stripe_invoice_status: invoice.status === "paid" ? "paid" : "open",
      stripe_hosted_invoice_url: invoice.hosted_invoice_url ?? null,
      stripe_invoice_pdf: invoice.invoice_pdf ?? null,
      invoice_sent_at: new Date().toISOString(), stripe_invoice_error: null,
    }).eq("id", data.id).eq("stripe_invoice_id", invoiceId);
    return true;
  } catch {
    await admin.from("diary_pr_inquiries").update({
      stripe_invoice_status: "failed",
      stripe_invoice_error: "Invoice finalization or delivery needs retry.",
      stripe_invoice_last_attempt_at: new Date().toISOString(),
    }).eq("id", data.id);
    return false;
  }
}

export async function reconcileDiaryInvoices(): Promise<{ drafts: number; sent: number; failed: number }> {
  if (!stripeDiaryConfigured()) return { drafts: 0, sent: 0, failed: 0 };
  const admin = createAdminClient();
  const { data, error } = await admin.from("diary_pr_inquiries").select("id,published_at,stripe_invoice_id,stripe_invoice_status")
    .eq("status", "booked").in("stripe_invoice_status", ["not_created", "draft", "failed"])
    .limit(15);
  if (error) return { drafts: 0, sent: 0, failed: 1 };
  let drafts = 0, sent = 0, failed = 0;
  for (const row of data ?? []) {
    if (!row.stripe_invoice_id) {
      if (await createDiaryDraftInvoice(row.id)) drafts++;
      else failed++;
    }
    if (row.published_at) {
      if (await sendPublishedDiaryInvoice(row.id)) sent++;
      else failed++;
    }
  }
  return { drafts, sent, failed };
}
