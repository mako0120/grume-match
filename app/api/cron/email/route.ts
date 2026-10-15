import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function nextAttemptAt(attempts: number) {
  const delayMinutes = Math.min(60, Math.max(5, 5 * 2 ** Math.max(0, attempts)));
  return new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
}

function safeError(value: unknown) {
  const message =
    value instanceof Error ? value.message : typeof value === "string" ? value : "email_send_failed";

  return message.slice(0, 500);
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
      sent: 0,
      failed: 0,
    });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: rows, error } = await supabase
    .from("notification_email_outbox")
    .select("id,email,subject,body,attempts")
    .in("status", ["pending", "failed"])
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

  let sent = 0;
  let failed = 0;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  for (const row of rows ?? []) {
    const body = siteUrl
      ? row.body + "\n\n確認: " + siteUrl + "/notifications"
      : row.body;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [row.email],
          subject: "[GOURMET DIARY] " + row.subject,
          text: body,
        }),
      });

      if (!response.ok) {
        const detail = safeError(await response.text());
        const attempts = row.attempts + 1;

        await supabase
          .from("notification_email_outbox")
          .update({
            status: "failed",
            attempts,
            available_at: nextAttemptAt(attempts),
            last_error: detail,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        failed += 1;
        continue;
      }

      await supabase
        .from("notification_email_outbox")
        .update({
          status: "sent",
          attempts: row.attempts + 1,
          sent_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      sent += 1;
    } catch (sendError) {
      const attempts = row.attempts + 1;

      await supabase
        .from("notification_email_outbox")
        .update({
          status: "failed",
          attempts,
          available_at: nextAttemptAt(attempts),
          last_error: safeError(sendError),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      failed += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    processed: rows?.length ?? 0,
    sent,
    failed,
  });
}
