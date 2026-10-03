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
    | "performance_review"
    | "post_report_review"
    | "post_report_missing"
    | "review_low";
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
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    overdueDeliverablesResult,
    readyPaymentsResult,
    overduePaymentsResult,
    failedPaymentsResult,
    disputesResult,
    noShowsResult,
    evidenceResult,
    postReportsResult,
    unreportedPostsResult,
    lowReviewsResult,
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

    supabase
      .from("creator_performance_evidence")
      .select("id,measured_on,created_at,creator_profiles(display_name)")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(20),

    supabase
      .from("pr_post_reports")
      .select("id,submitted_at,creator_profiles(display_name),restaurants(name)")
      .eq("status", "pending")
      .order("submitted_at", { ascending: true })
      .limit(20),

    // SNS posts up for a week with no verified views yet: ask the Creator.
    supabase
      .from("deliverables")
      .select(
        "id,booking_id,platform,submitted_at,pr_post_reports(status),bookings!inner(creator_profiles(display_name),campaigns(restaurants(name)))",
      )
      .not("submitted_url", "is", null)
      .lt("submitted_at", weekAgo)
      .not("platform", "in", "(ugc_photo,ugc_video)")
      .order("submitted_at", { ascending: true })
      .limit(40),

    supabase
      .from("pr_reviews")
      .select("id,booking_id,direction,rating,created_at,creator_profiles(display_name),restaurants(name)")
      .lte("rating", 2)
      .is("followed_up_at", null)
      .order("created_at", { ascending: true })
      .limit(20),
  ]);

  const inboxError = [
    overdueDeliverablesResult.error,
    readyPaymentsResult.error,
    overduePaymentsResult.error,
    failedPaymentsResult.error,
    disputesResult.error,
    noShowsResult.error,
    evidenceResult.error,
    postReportsResult.error,
    unreportedPostsResult.error,
    lowReviewsResult.error,
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

  for (const row of noShows) {
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

  for (const row of evidenceResult.data ?? []) {
    const creator = one(row.creator_profiles);

    items.push({
      id: "performance:" + row.id,
      kind: "performance_review",
      title: "実績スクショの確認",
      detail: (creator?.display_name ?? "Creator") + "・" + row.measured_on + "計測",
      href: "/admin/performance",
      occurredAt: row.created_at,
    });
  }

  for (const row of postReportsResult.data ?? []) {
    items.push({
      id: "post-report:" + row.id,
      kind: "post_report_review",
      title: "投稿レポートの読み取り",
      detail:
        (one(row.creator_profiles)?.display_name ?? "Creator") +
        "・" +
        (one(row.restaurants)?.name ?? "店舗") +
        "（npm run post-reports -- list）",
      href: null,
      occurredAt: row.submitted_at,
    });
  }

  for (const row of unreportedPostsResult.data ?? []) {
    const report = one(row.pr_post_reports as { status: string } | { status: string }[] | null);
    if (report && report.status !== "rejected") continue;
    const booking = one(row.bookings);
    const campaign = one(booking?.campaigns);

    items.push({
      id: "post-report-missing:" + row.id,
      kind: "post_report_missing",
      title: report ? "投稿レポートの再送待ち" : "投稿レポート未着",
      detail:
        (one(booking?.creator_profiles)?.display_name ?? "Creator") +
        "・" +
        (one(campaign?.restaurants)?.name ?? "店舗") +
        "・インサイトのスクショをCreatorに依頼",
      href: "/restaurant/bookings/" + row.booking_id,
      occurredAt: row.submitted_at ?? now,
    });
  }

  for (const row of lowReviewsResult.data ?? []) {
    items.push({
      id: "review:" + row.id,
      kind: "review_low",
      title: row.direction === "restaurant_to_creator" ? "低評価（店舗→Creator）" : "低評価（Creator→店舗）",
      detail:
        "★" +
        row.rating +
        "・" +
        (one(row.creator_profiles)?.display_name ?? "Creator") +
        "・" +
        (one(row.restaurants)?.name ?? "店舗"),
      href: "/restaurant/bookings/" + row.booking_id,
      occurredAt: row.created_at,
    });
  }

  return items.sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );
}
