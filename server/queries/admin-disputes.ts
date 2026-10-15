import { createClient } from "@/lib/supabase/server";

type Relation<T> = T | T[] | null;

function one<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
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

export async function listOpenBookingDisputes() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("booking_disputes")
    .select(`
      id,
      booking_id,
      application_id,
      opened_by,
      reason,
      status,
      application_status_before,
      payment_status_before,
      created_at,
      bookings(
        status,
        creator_profiles(display_name),
        campaigns(
          title,
          restaurants(name)
        ),
        payments(amount,status)
      )
    `)
    .eq("status", "open")
    .order("created_at", { ascending: true });

  if (error) throw new Error("確認依頼を読み込めませんでした。");

  return (data ?? []).map((row) => {
    const booking = one(row.bookings);
    const creator = one(booking?.creator_profiles ?? null);
    const campaign = one(booking?.campaigns ?? null);
    const restaurant = one(campaign?.restaurants ?? null);
    const payment = one(booking?.payments ?? null);

    return {
      id: row.id,
      bookingId: row.booking_id,
      reason: row.reason,
      createdLabel: formatter.format(new Date(row.created_at)),
      creatorName: creator?.display_name ?? "Creator",
      restaurantName: restaurant?.name ?? "店舗",
      campaignTitle: campaign?.title ?? "PR案件",
      bookingStatus: booking?.status ?? "",
      paymentAmount: Number(payment?.amount ?? 0),
      paymentStatus: payment?.status ?? row.payment_status_before ?? "pending",
      applicationStatusBefore: row.application_status_before,
    };
  });
}
