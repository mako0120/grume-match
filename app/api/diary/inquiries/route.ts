import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateDiaryInquiry } from "@/lib/diary/inquiry";
import { currentDiaryPricing, priceForDiaryService } from "@/lib/diary/pricing";

export const runtime = "nodejs";

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function verifyChallenge(token: string, ip: string | null) {
  const secret = process.env.DIARY_TURNSTILE_SECRET_KEY;
  if (!secret || !token || token.length > 3000) return false;
  const params = new URLSearchParams({ secret, response: token });
  if (ip) params.set("remoteip", ip);
  try {
    const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: params,
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!result.ok) return false;
    const data = (await result.json()) as { success?: boolean; hostname?: string };
    const siteHost = process.env.NEXT_PUBLIC_SITE_URL;
    if (siteHost && data.hostname) {
      const expected = new URL(siteHost).hostname;
      if (data.hostname !== expected) return false;
    }
    return data.success === true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (
    process.env.DIARY_INQUIRIES_ENABLED !== "true" ||
    !process.env.DIARY_TURNSTILE_SECRET_KEY ||
    !process.env.NEXT_PUBLIC_DIARY_TURNSTILE_SITE_KEY
  ) {
    return json({ error: "受付準備中です。InstagramのDMからお問い合わせください。" }, 503);
  }

  // Same-origin and bot validation are defense-in-depth, not an RLS substitute.
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    return json({ error: "invalid_origin" }, 403);
  }
  const length = Number(request.headers.get("content-length") || "0");
  if (length > 8192) return json({ error: "payload_too_large" }, 413);
  let payload: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 8192) return json({ error: "payload_too_large" }, 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ error: "invalid_payload" }, 400);
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_payload" }, 400);
  }
  // Honeypot: answer identically to successful submissions, but persist nothing.
  if (payload.website) return json({ ok: true }, 200);
  const checked = validateDiaryInquiry(payload);
  if (!checked.ok) return json({ error: checked.error }, 400);
  const token = typeof payload.turnstileToken === "string" ? payload.turnstileToken : "";
  const verified = await verifyChallenge(token, request.headers.get("x-real-ip"));
  if (!verified) return json({ error: "セキュリティ認証を確認できませんでした。再度お試しください。" }, 403);

  try {
    const admin = createAdminClient();
    const { consent: _consent, compliance_confirmed: _confirmed, ...details } = checked.data;
    void _consent;
    void _confirmed;
    // Compute server-side, never trust prices or follower counts from the client.
    const pricing = currentDiaryPricing();
    const priceReference = priceForDiaryService(checked.data.service, pricing.followers);
    const { error } = await admin.from("diary_pr_inquiries").insert({
      ...details,
      post_price_reference_yen: priceReference,
      followers_at_inquiry: priceReference !== null ? pricing.followers : null,
      follower_snapshot_verified_at: priceReference !== null ? pricing.asOf : null,
      price_policy_version: priceReference !== null ? "2026-10-16-follower-video-tiers-v2" : null,
      privacy_consented_at: new Date().toISOString(),
      compliance_confirmed_at: new Date().toISOString(),
    });
    if (error) return json({ error: "ただいま送信できません。時間をおいてお試しください。" }, 503);
    return json({ ok: true }, 201);
  } catch {
    return json({ error: "ただいま送信できません。時間をおいてお試しください。" }, 503);
  }
}
