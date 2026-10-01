import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const code = request.nextUrl.searchParams.get("code");

  const destination = request.nextUrl.clone();
  destination.pathname = "/onboarding";
  destination.search = "";

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      return NextResponse.redirect(destination);
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(destination);
    }
  }

  const failed = request.nextUrl.clone();
  failed.pathname = "/login";
  failed.search = "";
  failed.searchParams.set(
    "message",
    "認証リンクを確認できませんでした。もう一度ログインしてください。",
  );

  return NextResponse.redirect(failed);
}
