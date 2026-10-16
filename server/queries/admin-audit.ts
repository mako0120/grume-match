import { createClient } from "@/lib/supabase/server";

const formatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export async function listAdminAuditLog() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("audit_logs")
    .select("id,actor_user_id,actor_role,action,entity_type,entity_id,created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error("監査ログを読み込めませんでした。");

  return (data ?? []).map((row) => ({
    ...row,
    createdLabel: formatter.format(new Date(row.created_at)),
  }));
}
