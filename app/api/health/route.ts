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
    const { error } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true });

    if (error) {
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
