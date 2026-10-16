import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTokyoVisit, safeBookingSiteUrl } from "@/lib/diary/booking";
import { diaryOwnerEmail, sendDiaryEmail } from "@/server/diary/email";

export async function sendOperatorBookingNotification(inquiryId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("diary_pr_inquiries")
    .select("id,restaurant_name,service,proposed_visit_at,agreed_fee_yen,operator_notify_state,operator_notify_attempts")
    .eq("id", inquiryId).eq("status", "booked").maybeSingle();
  if (!data || !["pending", "failed"].includes(data.operator_notify_state) ||
      data.operator_notify_attempts >= 5) return false;

  const claim = await admin.from("diary_pr_inquiries").update({
    operator_notify_state: "processing",
    operator_notify_attempts: data.operator_notify_attempts + 1,
  }).eq("id", inquiryId).eq("operator_notify_state", data.operator_notify_state)
    .eq("operator_notify_attempts", data.operator_notify_attempts)
    .select("id").maybeSingle();
  if (claim.error || !claim.data) return false;

  try {
    const owner = diaryOwnerEmail();
    if (!owner) throw new Error("DIARY_OPERATOR_NOTIFY_EMAIL is not configured");
    const link = safeBookingSiteUrl() + "/admin/diary-inquiries";
    await sendDiaryEmail(owner, "新しい案件が確定しました", [
      "企業が訪問日時と提示条件を承諾しました。",
      "店舗：" + data.restaurant_name,
      "内容：" + data.service,
      "訪問：" + formatTokyoVisit(data.proposed_visit_at),
      "合意報酬：" + Number(data.agreed_fee_yen).toLocaleString("ja-JP") + "円（税込）",
      "案件管理：" + link,
      "投稿公開後7日以内の支払いを原則とします。",
    ].join("\n"), "diary-booked-" + inquiryId);
    const update = await admin.from("diary_pr_inquiries").update({
      operator_notify_state: "sent",
      operator_notified_at: new Date().toISOString(),
    }).eq("id", inquiryId).eq("operator_notify_state", "processing");
    if (update.error) throw new Error("Notification delivery was not saved");
    return true;
  } catch {
    await admin.from("diary_pr_inquiries").update({
      operator_notify_state: "failed",
    }).eq("id", inquiryId).eq("operator_notify_state", "processing");
    return false;
  }
}

export async function retryDiaryBookingNotifications(): Promise<{ sent: number; failed: number }> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("diary_pr_inquiries")
    .select("id").eq("status", "booked").in("operator_notify_state", ["pending", "failed"])
    .lt("operator_notify_attempts", 5).limit(15);
  if (error) return { sent: 0, failed: 1 };
  let sent = 0;
  let failed = 0;
  for (const item of data ?? []) {
    if (await sendOperatorBookingNotification(item.id)) sent++;
    else failed++;
  }
  return { sent, failed };
}
