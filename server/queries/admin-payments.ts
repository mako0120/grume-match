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
      transfer_reference,
      transfer_note,
      transfer_recorded_at,
      created_at,
      creator_profiles(
        display_name,
        creator_payout_profiles(
          bank_name,
          branch_name,
          account_type,
          account_number,
          account_holder
        )
      ),
      bookings(
        id,
        campaigns(
          title,
          restaurants(name)
        )
      )
    `)
    .in("status", ["approved", "scheduled", "failed", "paid"])
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return data ?? [];
}
