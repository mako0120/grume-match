import { createClient } from "@/lib/supabase/server";

const paymentSelect = `
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
`;

export async function listAdminPayments() {
  const supabase = await createClient();
  const paidCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [activeResult, recentPaidResult] = await Promise.all([
    supabase
      .from("payments")
      .select(paymentSelect)
      .in("status", ["approved", "scheduled", "failed"])
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("payments")
      .select(paymentSelect)
      .eq("status", "paid")
      .gte("paid_at", paidCutoff)
      .order("paid_at", { ascending: false })
      .limit(50),
  ]);

  if (activeResult.error) throw new Error(activeResult.error.message);
  if (recentPaidResult.error) throw new Error(recentPaidResult.error.message);

  return [...(activeResult.data ?? []), ...(recentPaidResult.data ?? [])];
}
