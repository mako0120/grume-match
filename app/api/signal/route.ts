import { NextResponse, type NextRequest } from "next/server";
import { isSignalCode, normalizeSignalCode } from "@/lib/signal-metrics";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const allowedKinds = new Set(["landing_view", "reserve_click", "call_click"]);

// Anonymous landing-page touches. Stores only the event kind and time for the
// tracking link: no cookies, IP address or user agent are persisted.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const { code, kind } = (body ?? {}) as { code?: unknown; kind?: unknown };

  if (
    typeof code !== "string" ||
    typeof kind !== "string" ||
    !allowedKinds.has(kind) ||
    !isSignalCode(code)
  ) {
    return new NextResponse(null, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_signal_touch", {
    p_code: normalizeSignalCode(code),
    p_kind: kind,
  });

  return new NextResponse(null, {
    status: error ? 500 : 204,
    headers: { "Cache-Control": "no-store" },
  });
}
