import { createClient } from "@/lib/supabase/server";

export type AdminInboxItem = {
  id: string;
  kind:
    | "deliverable_overdue"
    | "payment_ready"
    | "payment_overdue"
    | "payment_failed"
    | "dispute"
    | "no_show";
  title: string;
  detail: string;
  href: string | null;
  occurredAt: string;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function getAdminInbox(): Promise<AdminInboxItem[]> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const [
    { data: overdueDeliverables },
    { data: readyPayments },
    { data: overduePayments },
    { data: failedPayments },
    { data: disputes },
    { data: noShows },
  ] = await Promise.all([
    supabase
      .from("deliverables")
      .select(
        "id,booking_id,platform,due_at,verification_status,bookings!inner(creator_profiles(display_name),campaigns(title,restaurants(name)))",
      )
      .lt("due_at", now)
      .neq("verification_status", "approved")
      .order("due_at", { ascending: true })
      .limit(20),

    supabase
      .from("payments")
      .select(
        "id,booking_id,amount,due_at,updated_at,status,creator_profiles(display_name),bookings(campaigns(title,restaurants(name)))",
      )
      .eq("status", "approved")
      .order("updated_at", { ascending: true })
      .limit(20),

    supabase
      .from("payments")
      .select(
        "id,booking_id,amount,due_at,status,creator_profiles(display_name),bookings(campaigns(title,restaurants(name)))",
      )
      .not("due_at", "is", null)
      .lt("due_at", now)
      .eq("status", "scheduled")
      .order("due_at", { ascending: true })
      .limit(20),

    supabase
      .from("payments")
      .select(
        "id,booking_id,amount,updated_at,status,creator_profiles(display_name),bookings(campaigns(title,restaurants(name)))",
      )
      .eq("status", "failed")
      .order("updated_at", { ascending: true })
      .limit(20),

    supabase
      .from("applications")
      .select(
        "id,campaign_id,updated_at,status,creator_profiles(display_name),campaigns(title,restaurants(name))",
      )
      .eq("status", "dispute")
      .order("updated_at", { ascending: true })
      .limit(20),

    supabase
      .from("bookings")
      .select(
        "id,campaign_id,confirmed_at,status,creator_profiles(display_name),campaigns(title,restaurants(name))",
      )
      .eq("status", "no_show")
      .order("confirmed_at", { ascending: false })
      .limit(20),
  ]);

  const items: AdminInboxItem[] = [];

  for (const row of overdueDeliverables ?? []) {
    const booking = one(row.bookings);
    const creator = one(booking?.creator_profiles);
    const campaign = one(booking?.campaigns);
    const restaurant = one(campaign?.restaurants);

    items.push({
      id: "deliverable:" + row.id,
      kind: "deliverable_overdue",
      title: "投稿期限超過",
      detail:
        (creator?.display_name ?? "Creator") +
        "・" +
        (restaurant?.name ?? "店舗") +
        "・" +
        String(row.platform),
      href: "/restaurant/bookings/" + row.booking_id,
      occurredAt: row.due_at,
    });
  }


  for (const row of readyPayments ?? []) {
    const creator = one(row.creator_profiles);
    const booking = one(row.bookings);
    const campaign = one(booking?.campaigns);
    const restaurant = one(campaign?.restaurants);

    items.push({
      id: "payment-ready:" + row.id,
      kind: "payment_ready",
      title: "報酬の支払い待ち",
      detail:
        (creator?.display_name ?? "Creator") +
        "・" +
        (restaurant?.name ?? "店舗") +
        "・¥" +
        Number(row.amount).toLocaleString(),
      href: "/admin/payments",
      occurredAt: row.updated_at,
    });
  }

  for (const row of overduePayments ?? []) {
    const creator = one(row.creator_profiles);
    const booking = one(row.bookings);
    const campaign = one(booking?.campaigns);
    const restaurant = one(campaign?.restaurants);

    items.push({
      id: "payment:" + row.id,
      kind: "payment_overdue",
      title: "支払期限超過",
      detail:
        (creator?.display_name ?? "Creator") +
        "・" +
        (restaurant?.name ?? "店舗") +
        "・¥" +
        Number(row.amount).toLocaleString(),
      href: "/admin/payments",
      occurredAt: row.due_at ?? now,
    });
  }

  for (const row of failedPayments ?? []) {
    const creator = one(row.creator_profiles);
    const booking = one(row.bookings);
    const campaign = one(booking?.campaigns);
    const restaurant = one(campaign?.restaurants);

    items.push({
      id: "payment-failed:" + row.id,
      kind: "payment_failed",
      title: "振込エラー",
      detail:
        (creator?.display_name ?? "Creator") +
        "・" +
        (restaurant?.name ?? "店舗") +
        "・¥" +
        Number(row.amount).toLocaleString(),
      href: "/admin/payments",
      occurredAt: row.updated_at,
    });
  }

  for (const row of disputes ?? []) {
    const creator = one(row.creator_profiles);
    const campaign = one(row.campaigns);
    const restaurant = one(campaign?.restaurants);

    items.push({
      id: "dispute:" + row.id,
      kind: "dispute",
      title: "確認が必要な案件",
      detail:
        (creator?.display_name ?? "Creator") +
        "・" +
        (restaurant?.name ?? "店舗") +
        "・" +
        (campaign?.title ?? "PR案件"),
      href: "/restaurant/campaigns/" + row.campaign_id + "/applications",
      occurredAt: row.updated_at,
    });
  }

  for (const row of noShows ?? []) {
    const creator = one(row.creator_profiles);
    const campaign = one(row.campaigns);
    const restaurant = one(campaign?.restaurants);

    items.push({
      id: "no-show:" + row.id,
      kind: "no_show",
      title: "来店未確認",
      detail:
        (creator?.display_name ?? "Creator") +
        "・" +
        (restaurant?.name ?? "店舗") +
        "・" +
        (campaign?.title ?? "PR案件"),
      href: "/restaurant/bookings/" + row.id,
      occurredAt: row.confirmed_at,
    });
  }

  return items.sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );
}
