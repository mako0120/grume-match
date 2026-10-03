import { NextResponse, type NextRequest } from "next/server";
import { isSignalCode, normalizeSignalCode } from "@/lib/signal-metrics";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Anonymous landing-page views. Stores only the time of the view for the
// tracking link: no cookies, IP address or user agent are persisted.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const { code } = (body ?? {}) as { code?: unknown };

  if (typeof code !== "string" || !isSignalCode(code)) {
    return new NextResponse(null, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_signal_view", {
    p_code: normalizeSignalCode(code),
  });

  return new NextResponse(null, {
    status: error ? 500 : 204,
    headers: { "Cache-Control": "no-store" },
  });
}
