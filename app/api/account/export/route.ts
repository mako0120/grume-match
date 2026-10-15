import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function downloadName() {
  const date = new Date().toISOString().slice(0, 10);
  return "gourmet-diary-data-" + date + ".json";
}

export async function GET() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = authData.user.id;

  const [
    userResult,
    policiesResult,
    closureResult,
    notificationsResult,
    auditResult,
  ] = await Promise.all([
    supabase
      .from("users")
      .select("id,email,role,status,created_at,updated_at,onboarding_completed_at")
      .eq("id", userId)
      .single(),
    supabase
      .from("user_policy_acceptances")
      .select("policy,version,accepted_at")
      .eq("user_id", userId)
      .order("accepted_at", { ascending: true }),
    supabase
      .from("account_closure_requests")
      .select("id,reason,status,admin_note,created_at,resolved_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("notifications")
      .select("id,type,title,body,read_at,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("audit_logs")
      .select("id,actor_role,action,entity_type,entity_id,created_at")
      .eq("actor_user_id", userId)
      .order("created_at", { ascending: true }),
  ]);

  if (userResult.error || !userResult.data) {
    return NextResponse.json({ error: "account_export_failed" }, { status: 500 });
  }

  const role = userResult.data.role;

  const exportData: Record<string, unknown> = {
    export_version: "2026-10-15-alpha1",
    generated_at: new Date().toISOString(),
    account: userResult.data,
    policy_acceptances: policiesResult.data ?? [],
    account_closure_requests: closureResult.data ?? [],
    notifications: notificationsResult.data ?? [],
    audit_events_performed_by_you: auditResult.data ?? [],
  };

  if (role === "creator") {
    const { data: profile } = await supabase
      .from("creator_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const creatorId = profile?.id ?? null;

    const [
      socialResult,
      payoutResult,
      standbyResult,
      applicationResult,
      bookingResult,
    ] = creatorId
      ? await Promise.all([
          supabase
            .from("creator_social_accounts")
            .select("*")
            .eq("creator_id", creatorId)
            .order("created_at", { ascending: true }),
          supabase
            .from("creator_payout_profiles")
            .select("*")
            .eq("creator_id", creatorId)
            .maybeSingle(),
          supabase
            .from("creator_standby")
            .select("*")
            .eq("creator_id", creatorId)
            .maybeSingle(),
          supabase
            .from("applications")
            .select("*")
            .eq("creator_id", creatorId)
            .order("created_at", { ascending: true }),
          supabase
            .from("bookings")
            .select("*")
            .eq("creator_id", creatorId)
            .order("created_at", { ascending: true }),
        ])
      : [
          { data: [] },
          { data: null },
          { data: null },
          { data: [] },
          { data: [] },
        ];

    const bookingIds = (bookingResult.data ?? []).map((row) => row.id);

    const [deliverableResult, paymentResult, disputeResult] = bookingIds.length
      ? await Promise.all([
          supabase
            .from("deliverables")
            .select("*")
            .in("booking_id", bookingIds)
            .order("created_at", { ascending: true }),
          supabase
            .from("payments")
            .select("*")
            .in("booking_id", bookingIds)
            .order("created_at", { ascending: true }),
          supabase
            .from("booking_disputes")
            .select("*")
            .in("booking_id", bookingIds)
            .order("created_at", { ascending: true }),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

    exportData.creator = {
      profile,
      social_accounts: socialResult.data ?? [],
      payout_profile: payoutResult.data ?? null,
      standby: standbyResult.data ?? null,
      applications: applicationResult.data ?? [],
      bookings: bookingResult.data ?? [],
      deliverables: deliverableResult.data ?? [],
      payments: paymentResult.data ?? [],
      disputes: disputeResult.data ?? [],
    };
  }

  if (role === "restaurant") {
    const { data: memberships } = await supabase
      .from("restaurant_memberships")
      .select("id,restaurant_id,role,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    const restaurantIds = (memberships ?? []).map((row) => row.restaurant_id);

    const [restaurantResult, campaignResult] = restaurantIds.length
      ? await Promise.all([
          supabase
            .from("restaurants")
            .select("*")
            .in("id", restaurantIds)
            .order("created_at", { ascending: true }),
          supabase
            .from("campaigns")
            .select("*")
            .in("restaurant_id", restaurantIds)
            .order("created_at", { ascending: true }),
        ])
      : [{ data: [] }, { data: [] }];

    const campaignIds = (campaignResult.data ?? []).map((row) => row.id);

    const [applicationResult, bookingResult] = campaignIds.length
      ? await Promise.all([
          supabase
            .from("applications")
            .select("*")
            .in("campaign_id", campaignIds)
            .order("created_at", { ascending: true }),
          supabase
            .from("bookings")
            .select("*")
            .in("campaign_id", campaignIds)
            .order("created_at", { ascending: true }),
        ])
      : [{ data: [] }, { data: [] }];

    const bookingIds = (bookingResult.data ?? []).map((row) => row.id);

    const [deliverableResult, paymentResult, disputeResult] = bookingIds.length
      ? await Promise.all([
          supabase
            .from("deliverables")
            .select("*")
            .in("booking_id", bookingIds)
            .order("created_at", { ascending: true }),
          supabase
            .from("payments")
            .select("*")
            .in("booking_id", bookingIds)
            .order("created_at", { ascending: true }),
          supabase
            .from("booking_disputes")
            .select("*")
            .in("booking_id", bookingIds)
            .order("created_at", { ascending: true }),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

    exportData.restaurant = {
      memberships: memberships ?? [],
      restaurants: restaurantResult.data ?? [],
      campaigns: campaignResult.data ?? [],
      applications: applicationResult.data ?? [],
      bookings: bookingResult.data ?? [],
      deliverables: deliverableResult.data ?? [],
      payments: paymentResult.data ?? [],
      disputes: disputeResult.data ?? [],
    };
  }

  const body = JSON.stringify(exportData, null, 2);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${downloadName()}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
