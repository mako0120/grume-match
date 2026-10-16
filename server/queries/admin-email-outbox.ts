import { createClient } from "@/lib/supabase/server";

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return "非表示";
  const visible = local.slice(0, 2);
  return visible + "***@" + domain;
}

const formatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export async function listFailedNotificationEmails() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notification_email_outbox")
    .select("id,email,subject,status,attempts,last_error,available_at,updated_at")
    .eq("status", "failed")
    .order("updated_at", { ascending: true })
    .limit(100);

  if (error) throw new Error("メール配信エラーを読み込めませんでした。");

  return (data ?? []).map((row) => ({
    id: row.id,
    emailLabel: maskEmail(row.email),
    subject: row.subject,
    attempts: row.attempts,
    lastError: row.last_error ?? "",
    retryLabel: formatter.format(new Date(row.available_at)),
    updatedAt: row.updated_at,
  }));
}
