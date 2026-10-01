import { createClient } from "@/lib/supabase/server";

export async function listAdminPayments() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payments")
    .select(`
      id,
      amount,
      currency,
      status,
      due_at,
      paid_at,
      created_at,
      creator_profiles(display_name),
      bookings(
        id,
        campaigns(
          title,
          restaurants(name)
        )
      )
    `)
    .in("status", ["approved", "scheduled", "failed"])
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}
