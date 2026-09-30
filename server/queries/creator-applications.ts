import { createClient } from "@/lib/supabase/server";

export async function listCreatorApplications() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("applications")
    .select(`
      id,
      status,
      party_size,
      applied_at,
      campaigns(
        id,
        title,
        cash_reward,
        area,
        restaurants(name)
      )
    `)
    .order("applied_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}
