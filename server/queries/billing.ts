import { platformFee } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

type Relation<T> = T | T[] | null;

function single<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export type FeeRow = {
  id: string;
  bookingId: string;
  baseAmount: number;
  fee: number;
  status: "pending" | "invoiced" | "paid" | "waived";
  note: string | null;
  createdAt: string;
  creatorName: string;
  campaignTitle: string;
};

type RawFee = {
  id: string;
  booking_id: string;
  base_amount: number;
  fee: number;
  status: FeeRow["status"];
  note: string | null;
  created_at: string;
  bookings: Relation<{
    creator_profiles: Relation<{ display_name: string }>;
    campaigns: Relation<{ title: string }>;
  }>;
};

const monthFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "long",
});

export type InvoiceRow = {
  id: string;
  period: string;
  subtotal: number;
  tax: number;
  total: number;
  status: "open" | "paid" | "void";
  hostedInvoiceUrl: string | null;
  createdAt: string;
};

/** The signed-in Restaurant's billing settings and Stripe invoices. */
export async function getRestaurantInvoices() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("restaurant_memberships")
    .select("restaurant_id,restaurants(billing_email)")
    .eq("user_id", authData.user?.id ?? "")
    .limit(1)
    .maybeSingle();

  const { data } = await supabase
    .from("platform_invoices")
    .select("id,period,subtotal,tax,total,status,hosted_invoice_url,created_at")
    .neq("status", "void")
    .order("period", { ascending: false })
    .limit(24);

  return {
    restaurantId: (membership?.restaurant_id as string | undefined) ?? null,
    billingEmail:
      single(membership?.restaurants as Relation<{ billing_email: string | null }> ?? null)?.billing_email ?? null,
    invoices: ((data ?? []) as {
      id: string;
      period: string;
      subtotal: number;
      tax: number;
      total: number;
      status: InvoiceRow["status"];
      hosted_invoice_url: string | null;
      created_at: string;
    }[]).map((row) => ({
      id: row.id,
      period: row.period,
      subtotal: row.subtotal,
      tax: row.tax,
      total: row.total,
      status: row.status,
      hostedInvoiceUrl: row.hosted_invoice_url,
      createdAt: row.created_at,
    })),
  };
}

/** The signed-in Restaurant's fees, grouped by month (newest first). */
export async function getRestaurantBilling() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_fees")
    .select(
      "id,booking_id,base_amount,fee,status,note,created_at,bookings(creator_profiles(display_name),campaigns(title))",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);

  const months = new Map<string, { label: string; fees: FeeRow[]; feeTotal: number; creatorTotal: number }>();
  for (const row of (data ?? []) as unknown as RawFee[]) {
    const booking = single(row.bookings);
    const fee: FeeRow = {
      id: row.id,
      bookingId: row.booking_id,
      baseAmount: row.base_amount,
      fee: row.fee,
      status: row.status,
      note: row.note,
      createdAt: row.created_at,
      creatorName: single(booking?.creator_profiles ?? null)?.display_name ?? "Creator",
      campaignTitle: single(booking?.campaigns ?? null)?.title ?? "PR案件",
    };
    const label = monthFormatter.format(new Date(row.created_at));
    const month = months.get(label) ?? { label, fees: [], feeTotal: 0, creatorTotal: 0 };
    month.fees.push(fee);
    month.feeTotal += fee.fee;
    month.creatorTotal += fee.baseAmount;
    months.set(label, month);
  }

  return [...months.values()];
}

/** Fee of one booking: the recorded one, or the estimate before completion. */
export async function getBookingFee(bookingId: string, creatorPayment: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_fees")
    .select("fee,status,note")
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (data) {
    return { fee: data.fee as number, status: data.status as string, note: data.note as string | null, estimate: false };
  }

  // No completed PR yet: the first one to complete will be free.
  const { count } = await supabase.from("platform_fees").select("id", { count: "exact", head: true });
  if (!count) {
    return { fee: 0, status: "estimate", note: "最初に完了したPRは手数料無料", estimate: true };
  }
  return { fee: platformFee(creatorPayment), status: "estimate", note: null, estimate: true };
}

/** Recorded fees by booking, for adding to PR cost. */
export async function getFeesByBooking() {
  const supabase = await createClient();
  const { data } = await supabase.from("platform_fees").select("booking_id,fee").limit(1000);
  return new Map(((data ?? []) as { booking_id: string; fee: number }[]).map((row) => [row.booking_id, row.fee]));
}
