import { createClient } from "@/lib/supabase/server";

export async function getCreatorWallet() {
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
      bookings(
        id,
        campaigns(
          title,
          restaurants(name)
        )
      )
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const payments = data ?? [];
  const totals = payments.reduce(
    (acc, payment) => {
      const amount = Number(payment.amount ?? 0);
      acc.total += amount;
      if (payment.status === "paid") acc.paid += amount;
      else if (payment.status === "approved" || payment.status === "scheduled") acc.upcoming += amount;
      else acc.pending += amount;
      return acc;
    },
    { total: 0, paid: 0, upcoming: 0, pending: 0 },
  );

  return { payments, totals };
}
