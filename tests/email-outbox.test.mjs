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


test("email delivery uses a lease and provider idempotency key", async () => {
  const [migration, route] = await Promise.all([
    readFile("supabase/migrations/202610150008_email_delivery_claim.sql", "utf8"),
    readFile("app/api/cron/email/route.ts", "utf8"),
  ]);

  assert.match(migration, /'processing'/);
  assert.match(migration, /provider_message_id/);
  assert.match(migration, /email_not_retryable/);
  assert.match(route, /Idempotency-Key/);
  assert.match(route, /gourmet-diary-notification/);
  assert.match(route, /status: "processing"/);
  assert.match(route, /claimed_at/);
  assert.match(route, /leaseUntil/);
});


test("suspension results can reach a suspended account through the email outbox", async () => {
  const source = await readFile(
    "supabase/migrations/202610150011_suspension_notifications.sql",
    "utf8",
  );

  assert.match(source, /participant_suspended/);
  assert.match(source, /account_suspended/);
  assert.match(source, /account_closure_dismissed/);
  assert.match(source, /notify_account_closure_result/);
});
