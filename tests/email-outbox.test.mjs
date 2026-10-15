import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("new in-app notifications are queued for asynchronous email delivery", async () => {
  const source = await readFile(
    "supabase/migrations/202610150007_notification_email_outbox.sql",
    "utf8",
  );

  assert.match(source, /notifications_enqueue_email/);
  assert.match(source, /notification_email_outbox/);
  assert.match(source, /on conflict \(notification_id\) do nothing/);
});

test("email cron retries failures without rolling back transactions", async () => {
  const source = await readFile("app/api/cron/email/route.ts", "utf8");

  assert.match(source, /RESEND_API_KEY/);
  assert.match(source, /status: "failed"/);
  assert.match(source, /attempts < 5|\.lt\("attempts", 5\)/);
  assert.match(source, /nextAttemptAt/);
});

test("Admin can review and retry failed email delivery", async () => {
  const [page, action, inbox] = await Promise.all([
    readFile("app/admin/email/page.tsx", "utf8"),
    readFile("server/actions/email-outbox.ts", "utf8"),
    readFile("server/queries/admin-inbox.ts", "utf8"),
  ]);

  assert.match(page, /再送待ちに戻す/);
  assert.match(action, /admin_retry_notification_email/);
  assert.match(inbox, /email_failed/);
});
