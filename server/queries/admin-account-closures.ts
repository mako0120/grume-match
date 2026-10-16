import { createClient } from "@/lib/supabase/server";

const formatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export async function listPendingAccountClosures() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("account_closure_requests")
    .select("id,user_id,reason,status,created_at,users(email,role,status)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw new Error("アカウント依頼を読み込めませんでした。");

  return (data ?? []).map((row) => ({
    ...row,
    createdLabel: formatter.format(new Date(row.created_at)),
  }));
}
