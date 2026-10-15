import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Check = {
  key: string;
  ok: boolean;
  detail: string;
};

export async function GET() {
  const checks: Check[] = [
    {
      key: "site_url",
      ok: Boolean(process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://")),
      detail: "Canonical HTTPS site URL",
    },
    {
      key: "operator_name",
      ok: Boolean(process.env.NEXT_PUBLIC_OPERATOR_NAME?.trim()),
      detail: "Public operator name",
    },
    {
      key: "support_email",
      ok: Boolean(process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.includes("@")),
      detail: "Public support contact",
    },
    {
      key: "supabase_url",
      ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      detail: "Supabase URL",
    },
    {
      key: "supabase_publishable_key",
      ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
      detail: "Supabase browser key",
    },
    {
      key: "supabase_server_secret",
      ok: Boolean(
        process.env.SUPABASE_SECRET_KEY ??
          process.env.SUPABASE_SERVICE_ROLE_KEY,
      ),
      detail: "Supabase server secret",
    },
    {
      key: "cron_secret",
      ok: Boolean(process.env.CRON_SECRET),
      detail: "Cron authorization secret",
    },
  ];

  const envReady = checks.every((check) => check.ok);
  let databaseReady = false;

  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.SUPABASE_SECRET_KEY ??
      process.env.SUPABASE_SERVICE_ROLE_KEY)
  ) {
    try {
      const supabase = createAdminClient();
      const requiredTables = [
        "campaigns",
        "applications",
        "bookings",
        "deliverables",
        "payments",
        "booking_disputes",
        "creator_payout_profiles",
        "user_policy_acceptances",
      ] as const;

      const results = await Promise.all(
        requiredTables.map((table) =>
          supabase.from(table).select("*", { head: true }).limit(1),
        ),
      );

      databaseReady = results.every((result) => !result.error);
    } catch {
      databaseReady = false;
    }
  }

  const publicLaunchEnabled =
    process.env.PUBLIC_LAUNCH_ENABLED === "true";

  const blockers = [
    ...checks.filter((check) => !check.ok).map((check) => check.key),
    ...(databaseReady ? [] : ["database_schema"]),
    ...(publicLaunchEnabled ? [] : ["public_launch_disabled"]),
  ];

  return NextResponse.json(
    {
      ok: envReady && databaseReady && publicLaunchEnabled,
      mode: publicLaunchEnabled ? "public" : "private_alpha",
      environmentReady: envReady,
      databaseReady,
      publicLaunchEnabled,
      blockers,
      checks,
    },
    {
      status: envReady && databaseReady ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
