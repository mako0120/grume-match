import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function configured(name: string) {
  return Boolean(process.env[name]);
}

export async function GET() {
  const environment = {
    supabaseUrl: configured("NEXT_PUBLIC_SUPABASE_URL"),
    supabasePublishableKey: configured("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    supabaseServiceRoleKey: configured("SUPABASE_SERVICE_ROLE_KEY"),
    cronSecret: configured("CRON_SECRET"),
  };

  const envReady = Object.values(environment).every(Boolean);

  if (!envReady) {
    return NextResponse.json(
      {
        ok: false,
        app: "GOURMET DIARY PR OS",
        environment,
        database: "not_checked",
      },
      { status: 503 },
    );
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          app: "GOURMET DIARY PR OS",
          environment,
          database: "unreachable",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      app: "GOURMET DIARY PR OS",
      environment,
      database: "ok",
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        app: "GOURMET DIARY PR OS",
        environment,
        database: "unreachable",
      },
      { status: 503 },
    );
  }
}
