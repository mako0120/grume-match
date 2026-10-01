import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function environmentReady() {
  return [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.CRON_SECRET,
  ].every(Boolean);
}

export async function GET() {
  if (!environmentReady()) {
    return NextResponse.json(
      {
        ok: false,
        app: "GOURMET DIARY PR OS",
        environment: "incomplete",
        database: "not_checked",
      },
      { status: 503 },
    );
  }

  try {
    const supabase = createAdminClient();

    const checks = await Promise.all([
      supabase.from("users").select("id", { head: true }).limit(1),
      supabase.from("creator_profiles").select("id", { head: true }).limit(1),
      supabase.from("restaurants").select("id", { head: true }).limit(1),
      supabase.from("campaigns").select("id", { head: true }).limit(1),
      supabase.from("applications").select("id", { head: true }).limit(1),
      supabase.from("bookings").select("id", { head: true }).limit(1),
      supabase.from("payments").select("id", { head: true }).limit(1),
      supabase.from("campaign_target_creators").select("campaign_id", { head: true }).limit(1),
      supabase.from("creator_standby").select("creator_id", { head: true }).limit(1),
      supabase.from("booking_reschedule_requests").select("id", { head: true }).limit(1),
      supabase.from("notifications").select("id", { head: true }).limit(1),
    ]);

    if (checks.some((result) => result.error)) {
      return NextResponse.json(
        {
          ok: false,
          app: "GOURMET DIARY PR OS",
          environment: "ready",
          database: "schema_incomplete",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      app: "GOURMET DIARY PR OS",
      environment: "ready",
      database: "ok",
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        app: "GOURMET DIARY PR OS",
        environment: "ready",
        database: "unreachable",
      },
      { status: 503 },
    );
  }
}
