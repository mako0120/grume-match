import { NextRequest, NextResponse } from "next/server";
import { LICENSE_EXPIRING_DAYS } from "@/lib/content-rights";
import { createAdminClient } from "@/lib/supabase/admin";

const expiryFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "long",
  day: "numeric",
});

function memberRank(role: string) {
  return role === "owner" ? 0 : role === "manager" ? 1 : 2;
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = Date.now();
  const visitWindowStart = new Date(now + 23 * 60 * 60 * 1000).toISOString();
  const visitWindowEnd = new Date(now + 25 * 60 * 60 * 1000).toISOString();
  const dueWindowEnd = new Date(now + 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date(now).toISOString();

  const { data: closedCampaigns, error: closeError } = await supabase
    .from("campaigns")
    .update({ status: "closed" })
    .in("status", ["published", "recruiting"])
    .lt("application_deadline", nowIso)
    .select("id");

  if (closeError) {
    return NextResponse.json(
      { error: "campaign_close_failed" },
      { status: 500 },
    );
  }

  const licenseWindowEnd = new Date(
    now + LICENSE_EXPIRING_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [
    { data: upcomingBookings, error: bookingError },
    { data: dueDeliverables, error: deliverableError },
    { data: expiringLicenses, error: licenseError },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select(`
        id,
        creator_profiles(user_id),
        campaign_slots!inner(starts_at),
        campaigns(title,restaurants(name))
      `)
      .in("status", ["confirmed", "reschedule_requested"])
      .gte("campaign_slots.starts_at", visitWindowStart)
      .lte("campaign_slots.starts_at", visitWindowEnd),
    supabase
      .from("deliverables")
      .select(`
        id,
        due_at,
        verification_status,
        bookings(
          id,
          creator_profiles(user_id),
          campaigns(title,restaurants(name))
        )
      `)
      .neq("verification_status", "approved")
      .gte("due_at", nowIso)
      .lte("due_at", dueWindowEnd),
    supabase
      .from("content_usage_licenses")
      .select(`
        id,
        restaurant_id,
        expires_at,
        creator_profiles(display_name),
        restaurants(restaurant_memberships(user_id,role))
      `)
      .eq("status", "active")
      .gt("expires_at", nowIso)
      .lte("expires_at", licenseWindowEnd),
  ]);

  if (bookingError || deliverableError || licenseError) {
    return NextResponse.json(
      {
        error: "query_failed",
        bookingError: bookingError?.message ?? null,
        deliverableError: deliverableError?.message ?? null,
        licenseError: licenseError?.message ?? null,
      },
      { status: 500 },
    );
  }

  const notifications: Array<{
    user_id: string;
    type: string;
    title: string;
    body: string;
    dedupe_key: string;
  }> = [];

  for (const booking of upcomingBookings ?? []) {
    const creator = Array.isArray(booking.creator_profiles)
      ? booking.creator_profiles[0]
      : booking.creator_profiles;
    const campaign = Array.isArray(booking.campaigns)
      ? booking.campaigns[0]
      : booking.campaigns;
    const restaurant = Array.isArray(campaign?.restaurants)
      ? campaign.restaurants[0]
      : campaign?.restaurants;

    if (!creator?.user_id) continue;

    notifications.push({
      user_id: creator.user_id,
      type: "visit_reminder_24h",
      title: "明日はPR来店です",
      body: `${restaurant?.name ?? "店舗"}・${campaign?.title ?? "PR案件"}の来店予定があります。`,
      dedupe_key: `visit-24h:${booking.id}`,
    });
  }

  for (const deliverable of dueDeliverables ?? []) {
    const booking = Array.isArray(deliverable.bookings)
      ? deliverable.bookings[0]
      : deliverable.bookings;
    const creator = Array.isArray(booking?.creator_profiles)
      ? booking.creator_profiles[0]
      : booking?.creator_profiles;
    const campaign = Array.isArray(booking?.campaigns)
      ? booking.campaigns[0]
      : booking?.campaigns;

    if (!creator?.user_id) continue;

    notifications.push({
      user_id: creator.user_id,
      type: "deliverable_due_24h",
      title: "投稿期限が近づいています",
      body: `${campaign?.title ?? "PR案件"}の投稿期限まで24時間以内です。`,
      dedupe_key: `deliverable-due-24h:${deliverable.id}`,
    });
  }

  for (const license of expiringLicenses ?? []) {
    const creator = Array.isArray(license.creator_profiles)
      ? license.creator_profiles[0]
      : license.creator_profiles;
    const restaurant = Array.isArray(license.restaurants)
      ? license.restaurants[0]
      : license.restaurants;
    const members = [...(restaurant?.restaurant_memberships ?? [])].sort(
      (a, b) => memberRank(a.role) - memberRank(b.role),
    );
    const target = members[0];

    if (!target?.user_id) continue;

    notifications.push({
      user_id: target.user_id,
      type: "usage_license_expiring",
      title: "素材の利用期限が近づいています",
      body: `${creator?.display_name ?? "Creator"}さんの素材は${expiryFormatter.format(new Date(license.expires_at))}まで利用できます。期限後は広告・投稿から外してください。`,
      dedupe_key: `usage-license-expiring:${license.id}`,
    });
  }

  if (notifications.length) {
    const { error: insertError } = await supabase
      .from("notifications")
      .upsert(notifications, {
        onConflict: "dedupe_key",
        ignoreDuplicates: true,
      });

    if (insertError) {
      return NextResponse.json(
        { error: "notification_insert_failed", detail: insertError.message },
        { status: 500 },
      );
    }
  }

  // SIGNAL retention: raw events are kept for 13 months.
  const { data: purgedSignalEvents, error: purgeError } = await supabase.rpc(
    "purge_expired_signal_events",
  );

  if (purgeError) {
    return NextResponse.json(
      { error: "signal_purge_failed", detail: purgeError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    campaignsClosed: closedCampaigns?.length ?? 0,
    generated: notifications.length,
    signalEventsPurged: purgedSignalEvents ?? 0,
  });
}
