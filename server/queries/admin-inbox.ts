import { createClient } from "@/lib/supabase/server";

export type AdminInboxItem = {
  id: string;
  kind:
    | "deliverable_overdue"
    | "payment_ready"
    | "payment_overdue"
    | "payment_failed"
    | "dispute"
    | "no_show"
    | "account_closure"
    | "verification";
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
    overdueDeliverablesResult,
    readyPaymentsResult,
    overduePaymentsResult,
    failedPaymentsResult,
    disputesResult,
    noShowsResult,
    accountClosuresResult,
    unverifiedCreatorsResult,
    unverifiedRestaurantsResult,
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
      .from("booking_disputes")
      .select(
        "id,booking_id,reason,created_at,status,bookings(creator_profiles(display_name),campaigns(title,restaurants(name)))",
      )
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(20),

    supabase
      .from("bookings")
      .select(
        "id,campaign_id,no_show_at,status,creator_profiles(display_name),campaigns(title,restaurants(name))",
      )
      .eq("status", "no_show")
      .is("no_show_reviewed_at", null)
      .order("no_show_at", { ascending: true })
      .limit(20),

    supabase
      .from("account_closure_requests")
      .select("id,user_id,created_at,reason,users(email,role)")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(20),

    supabase
      .from("creator_profiles")
      .select("id", { count: "exact", head: true })
      .is("verified_at", null),

    supabase
      .from("restaurants")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .is("verified_at", null),
  ]);

  const inboxError = [
    overdueDeliverablesResult.error,
    readyPaymentsResult.error,
    overduePaymentsResult.error,
    failedPaymentsResult.error,
    disputesResult.error,
    noShowsResult.error,
    accountClosuresResult.error,
    unverifiedCreatorsResult.error,
    unverifiedRestaurantsResult.error,
  ].find(Boolean);

  if (inboxError) {
    throw new Error("運営Inboxを読み込めませんでした。");
  }

  const overdueDeliverables = overdueDeliverablesResult.data ?? [];
  const readyPayments = readyPaymentsResult.data ?? [];
  const overduePayments = overduePaymentsResult.data ?? [];
  const failedPayments = failedPaymentsResult.data ?? [];
  const disputes = disputesResult.data ?? [];
  const noShows = noShowsResult.data ?? [];
  const accountClosures = accountClosuresResult.data ?? [];
  const verificationCount =
    (unverifiedCreatorsResult.count ?? 0) +
    (unverifiedRestaurantsResult.count ?? 0);

  const items: AdminInboxItem[] = [];

  for (const row of overdueDeliverables) {
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


  for (const row of readyPayments) {
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

  for (const row of overduePayments) {
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

  for (const row of failedPayments) {
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

  for (const row of disputes) {
    const booking = one(row.bookings);
    const creator = one(booking?.creator_profiles);
    const campaign = one(booking?.campaigns);
    const restaurant = one(campaign?.restaurants);

    items.push({
      id: "dispute:" + row.id,
      kind: "dispute",
      title: "運営確認が必要",
      detail:
        (creator?.display_name ?? "Creator") +
        "・" +
        (restaurant?.name ?? "店舗") +
        "・" +
        (campaign?.title ?? "PR案件"),
      href: "/admin/disputes",
      occurredAt: row.created_at,
    });
  }

  for (const row of noShows) {
    const creator = one(row.creator_profiles);
    const campaign = one(row.campaigns);
    const restaurant = one(campaign?.restaurants);

    items.push({
      id: "no-show:" + row.id,
      kind: "no_show",
      title: "来店例外の確認",
      detail:
        (creator?.display_name ?? "Creator") +
        "・" +
        (restaurant?.name ?? "店舗") +
        "・" +
        (campaign?.title ?? "PR案件"),
      href: "/admin/no-shows",
      occurredAt: row.no_show_at ?? now,
    });
  }

  for (const row of accountClosures) {
    const user = one(row.users);

    items.push({
      id: "account-closure:" + row.id,
      kind: "account_closure",
      title: "アカウント停止依頼",
      detail:
        (user?.email ?? "利用者") +
        "・" +
        (user?.role ?? "user"),
      href: "/admin/accounts",
      occurredAt: row.created_at,
    });
  }

  if (verificationCount > 0) {
    items.push({
      id: "verification:pending",
      kind: "verification",
      title: "利用確認待ち",
      detail: verificationCount + "件のCreator・店舗確認があります",
      href: "/admin/verification",
      occurredAt: now,
    });
  }

  return items.sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );
}
