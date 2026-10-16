"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseVisitDate, makeBookingToken, bookingTokenHash, formatTokyoVisit, safeBookingSiteUrl, sevenDaysAfter } from "@/lib/diary/booking";
import { sendDiaryEmail, diaryEmailConfigured, diaryOwnerEmail } from "@/server/diary/email";
import { detectProhibitedPRRequest } from "@/lib/diary/inquiry";

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formId(form: FormData): string {
  const id = form.get("id");
  if (typeof id !== "string" || !idPattern.test(id)) throw new Error("Invalid inquiry ID");
  return id;
}

export async function reviewDiaryInquiryCompliance(form: FormData) {
  await requireRole(["admin"]);
  const id = formId(form);
  const decision = form.get("decision");
  if ((decision !== "approved" && decision !== "rejected") ||
      form.get("review_confirmed") !== "on") throw new Error("Review checklist confirmation required");

  const admin = createAdminClient();
  const update: Record<string, string> = {
    compliance_status: decision,
    compliance_reviewed_at: new Date().toISOString(),
  };
  if (decision === "rejected") update.status = "closed";
  const { data, error } = await admin.from("diary_pr_inquiries").update(update)
    .eq("id", id).in("status", ["new", "contacted"])
    .eq("compliance_status", "pending").select("id").maybeSingle();
  if (error || !data) throw new Error("Review failed or inquiry already progressed");
  revalidatePath("/admin/diary-inquiries");
}

export async function updateDiaryInquiryStatus(form: FormData) {
  await requireRole(["admin"]);
  const id = formId(form);
  const status = form.get("status");
  // A confirmed booking is possible ONLY through the enterprise one-time link.
  if (status !== "new" && status !== "contacted" && status !== "closed") {
    throw new Error("Use a confirmed, single-use enterprise booking link");
  }
  const admin = createAdminClient();
  const { data, error } = await admin.from("diary_pr_inquiries")
    .update({ status }).eq("id", id).in("status", ["new", "contacted"])
    .select("id").maybeSingle();
  if (error || !data) throw new Error("Cannot change a proposed or confirmed booking");
  revalidatePath("/admin/diary-inquiries");
}

export async function proposeDiaryVisit(form: FormData) {
  await requireRole(["admin"]);
  if (!diaryEmailConfigured() || !diaryOwnerEmail()) throw new Error("Email provider and owner notification mailbox must be configured");
  const origin = safeBookingSiteUrl();
  const id = formId(form);
  const requestedDate = form.get("visit_datetime");
  const visitAt = parseVisitDate(requestedDate);
  const duration = Number(form.get("duration_minutes"));
  const fee = Number(form.get("agreed_fee_yen"));
  const deliverables = String(form.get("deliverables") ?? "").trim();
  if (!visitAt || ![60, 90, 120, 180, 240].includes(duration) ||
      !Number.isSafeInteger(fee) || fee < 8000 || fee > 1000000 ||
      deliverables.length < 20 || deliverables.length > 2000 ||
      detectProhibitedPRRequest(deliverables)) {
    throw new Error("Review the visit date, duration, quote and allowed scope");
  }

  const admin = createAdminClient();
  const { data: item, error: readError } = await admin.from("diary_pr_inquiries")
    .select("id,restaurant_name,email,inquiry_kind,service,post_price_reference_yen,compliance_status,status")
    .eq("id", id).single();
  if (readError || !item || item.inquiry_kind !== "application" ||
      item.compliance_status !== "approved" ||
      !["new", "contacted", "proposed"].includes(item.status)) {
    throw new Error("Only approved applications can receive visit proposals");
  }
  if (fee < (item.post_price_reference_yen ?? 0)) {
    throw new Error("Agreed fee must not be below the published starting price");
  }

  const token = makeBookingToken();
  const hash = bookingTokenHash(token)!;
  const expiration = new Date(Date.now() + 7 * 86400_000).toISOString();
  const saved = await admin.from("diary_pr_inquiries").update({
    status: "proposed", proposed_visit_at: visitAt,
    proposed_visit_duration_minutes: duration,
    proposed_deliverables: deliverables,
    agreed_fee_yen: fee,
    payment_terms: "after_publish_7d",
    proposal_token_hash: hash,
    proposal_expires_at: expiration,
    proposal_email_state: "pending",
    proposal_sent_at: null,
  }).eq("id", id).in("status", ["new", "contacted", "proposed"])
    .eq("compliance_status", "approved").eq("inquiry_kind", "application")
    .select("id").maybeSingle();
  if (saved.error || !saved.data) throw new Error("Could not save proposal");

  const link = origin + "/diary/confirm/" + token;
  const body = [
    item.restaurant_name + " ご担当者様",
    "グルメ日誌｜大阪へのPRお申込みありがとうございます。",
    "下記の日時・制作内容・料金でご案内いたします。",
    "訪問日時：" + formatTokyoVisit(visitAt),
    "滞在予定：" + duration + "分",
    "制作内容：" + deliverables,
    "報酬（税込）：" + fee.toLocaleString("ja-JP") + "円",
    "お支払い：投稿公開後7日以内（全額）",
    "日程・条件にご了承いただけましたら、下の専用リンクで確定してください。",
    link,
    "確認リンク有効期限：7日間",
    "日時や内容の変更を希望する場合は、確定せずに本メールに返信してご相談ください。",
    "※公開前に撮影内容、PR表記、素材の利用範囲等を相互に確認します。",
  ].join("\n\n");
  try {
    await sendDiaryEmail(item.email, "PR訪問日時のご提案", body, "diary-proposal-" + id + "-" + hash.slice(0, 20));
    await admin.from("diary_pr_inquiries")
      .update({ proposal_email_state: "sent", proposal_sent_at: new Date().toISOString() })
      .eq("id", id).eq("proposal_token_hash", hash);
  } catch {
    await admin.from("diary_pr_inquiries").update({ proposal_email_state: "failed" })
      .eq("id", id).eq("proposal_token_hash", hash);
    throw new Error("Proposal saved, but email failed. Please resend from the inquiry admin page.");
  }
  revalidatePath("/admin/diary-inquiries");
}

export async function markDiaryPostPublished(form: FormData) {
  await requireRole(["admin"]);
  const id = formId(form);
  const postUrl = String(form.get("post_url") ?? "").trim();
  let parsed: URL;
  try { parsed = new URL(postUrl); } catch { throw new Error("Invalid post link"); }
  if (parsed.protocol !== "https:" ||
      !["instagram.com", "www.instagram.com"].includes(parsed.hostname) ||
      !/^\/(p|reel)\/[A-Za-z0-9_-]+\/?$/.test(parsed.pathname) ||
      parsed.username || parsed.password) throw new Error("Use a valid published Instagram post URL");
  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { data, error } = await admin.from("diary_pr_inquiries")
    .update({ published_at: now, published_post_url: parsed.origin + parsed.pathname,
      payment_due_at: sevenDaysAfter(now) })
    .eq("id", id).eq("status", "booked").is("published_at", null)
    .select("id").maybeSingle();
  if (error || !data) throw new Error("Not booked or already published");
  revalidatePath("/admin/diary-inquiries");
}

export async function markDiaryPaymentReceived(form: FormData) {
  await requireRole(["admin"]);
  const id = formId(form);
  const admin = createAdminClient();
  const { data, error } = await admin.from("diary_pr_inquiries")
    .update({ payment_received_at: new Date().toISOString() })
    .eq("id", id).eq("status", "booked")
    .not("published_at", "is", null)
    .is("payment_received_at", null)
    .select("id").maybeSingle();
  if (error || !data) throw new Error("Payment confirmation failed");
  revalidatePath("/admin/diary-inquiries");
}
