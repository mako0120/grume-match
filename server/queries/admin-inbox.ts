import { createClient } from "@/lib/supabase/server";

export type AdminInboxItem = {
  id: string;
  kind: "deliverable_overdue" | "payment_overdue" | "dispute" | "no_show";
  title: string;
  detail: string;
  href: string | null;
  occurredAt: string;
};

export async function getAdminInbox(): Promise<AdminInboxItem[]> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const [
    { data: overdueDeliverables },
    { data: overduePayments },
    { data: disputes },
    { data: noShows },
  ] = await Promise.all([
    supabase
      .from("deliverables")
      .select("id,booking_id,due_at,verification_status")
      .lt("due_at", now)
      .neq("verification_status", "approved")
      .order("due_at", { ascending: true })
      .limit(20),
    supabase
      .from("payments")
      .select("id,booking_id,amount,due_at,status")
      .not("due_at", "is", null)
      .lt("due_at", now)
      .neq("status", "paid")
      .order("due_at", { ascending: true })
      .limit(20),
    supabase
      .from("applications")
      .select("id,campaign_id,updated_at,status")
      .eq("status", "dispute")
      .order("updated_at", { ascending: true })
      .limit(20),
    supabase
      .from("bookings")
      .select("id,campaign_id,confirmed_at,status")
      .eq("status", "no_show")
      .order("confirmed_at", { ascending: false })
      .limit(20),
  ]);

  const items: AdminInboxItem[] = [];

  for (const row of overdueDeliverables ?? []) {
    items.push({
      id: `deliverable:${row.id}`,
      kind: "deliverable_overdue",
      title: "投稿期限超過",
      detail: `Deliverable ${row.id.slice(0, 8)} が未承認です`,
      href: `/restaurant/bookings/${row.booking_id}`,
      occurredAt: row.due_at,
    });
  }

  for (const row of overduePayments ?? []) {
    items.push({
      id: `payment:${row.id}`,
      kind: "payment_overdue",
      title: "支払期限超過",
      detail: `¥${Number(row.amount).toLocaleString()}・${row.status}`,
      href: `/restaurant/bookings/${row.booking_id}`,
      occurredAt: row.due_at ?? now,
    });
  }

  for (const row of disputes ?? []) {
    items.push({
      id: `dispute:${row.id}`,
      kind: "dispute",
      title: "紛争対応",
      detail: `Application ${row.id.slice(0, 8)}`,
      href: `/restaurant/campaigns/${row.campaign_id}/applications`,
      occurredAt: row.updated_at,
    });
  }

  for (const row of noShows ?? []) {
    items.push({
      id: `no-show:${row.id}`,
      kind: "no_show",
      title: "No-show確認",
      detail: `Booking ${row.id.slice(0, 8)}`,
      href: `/restaurant/bookings/${row.id}`,
      occurredAt: row.confirmed_at,
    });
  }

  return items.sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );
}
