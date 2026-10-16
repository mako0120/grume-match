import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { retryDiaryBookingNotifications } from "@/server/diary/notification";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function nextAttemptAt(attempts: number) {
  const delayMinutes = Math.min(
    60,
    Math.max(5, 5 * 2 ** Math.max(0, attempts)),
  );
  return new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
}

function safeError(value: unknown) {
  const message =
    value instanceof Error
      ? value.message
      : typeof value === "string"
        ? value
        : "email_send_failed";

  return message.slice(0, 500);
}

function providerMessageId(value: string) {
  try {
    const parsed = JSON.parse(value) as { id?: unknown };
    return typeof parsed.id === "string" ? parsed.id.slice(0, 255) : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    return NextResponse.json({
      ok: true,
      configured: false,
      processed: 0,
      claimed: 0,
      sent: 0,
      failed: 0,
    });
  }

  // Reconcile one-time booking notifications in addition to the standard outbox.
  // Failed confirmations stay in the private DB and are retried by this CRON.
  const diaryBookingNotifications = await retryDiaryBookingNotifications();
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: rows, error } = await supabase
    .from("notification_email_outbox")
    .select("id,notification_id,email,subject,body,attempts")
    .in("status", ["pending", "failed", "processing"])
    .lt("attempts", 5)
    .lte("available_at", now)
    .order("created_at", { ascending: true })
    .limit(25);

  if (error) {
    return NextResponse.json(
      { error: "email_outbox_query_failed" },
      { status: 500 },
    );
  }

  let claimed = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  for (const row of rows ?? []) {
    const claimedAt = new Date().toISOString();
    const leaseUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { data: claim, error: claimError } = await supabase
      .from("notification_email_outbox")
      .update({
        status: "processing",
        claimed_at: claimedAt,
        available_at: leaseUntil,
        updated_at: claimedAt,
      })
      .eq("id", row.id)
      .in("status", ["pending", "failed", "processing"])
      .lte("available_at", now)
      .select("id")
      .maybeSingle();

    if (claimError || !claim) {
      skipped += 1;
      continue;
    }

    claimed += 1;

    const body = siteUrl
      ? row.body + "\n\n確認: " + siteUrl + "/notifications"
      : row.body;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "gourmet-diary-notification/" + row.notification_id,
        },
        body: JSON.stringify({
          from,
          to: [row.email],
          subject: "[GOURMET DIARY] " + row.subject,
          text: body,
        }),
      });

      const responseBody = await response.text();

      if (!response.ok) {
        const attempts = row.attempts + 1;

        await supabase
          .from("notification_email_outbox")
          .update({
            status: "failed",
            attempts,
            available_at: nextAttemptAt(attempts),
            claimed_at: null,
            last_error: safeError(responseBody),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id)
          .eq("status", "processing");

        failed += 1;
        continue;
      }

      await supabase
        .from("notification_email_outbox")
        .update({
          status: "sent",
          attempts: row.attempts + 1,
          sent_at: new Date().toISOString(),
          claimed_at: null,
          provider_message_id: providerMessageId(responseBody),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("status", "processing");

      sent += 1;
    } catch (sendError) {
      const attempts = row.attempts + 1;

      await supabase
        .from("notification_email_outbox")
        .update({
          status: "failed",
          attempts,
          available_at: nextAttemptAt(attempts),
          claimed_at: null,
          last_error: safeError(sendError),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("status", "processing");

      failed += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    processed: rows?.length ?? 0,
    claimed,
    sent,
    failed,
    skipped,
    diaryBookingNotifications,
  });
}
