import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const [
    { data: upcomingBookings, error: bookingError },
    { data: dueDeliverables, error: deliverableError },
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
      .gte("due_at", new Date(now).toISOString())
      .lte("due_at", dueWindowEnd),
  ]);

  if (bookingError || deliverableError) {
    return NextResponse.json(
      {
        error: "query_failed",
        bookingError: bookingError?.message ?? null,
        deliverableError: deliverableError?.message ?? null,
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

  return NextResponse.json({
    ok: true,
    generated: notifications.length,
  });
}
