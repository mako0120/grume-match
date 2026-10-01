import { createClient } from "@/lib/supabase/server";

export async function listNotifications() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notifications")
    .select("id,type,title,body,read_at,created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return data ?? [];
}
