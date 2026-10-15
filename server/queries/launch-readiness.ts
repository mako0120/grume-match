import { createAdminClient } from "@/lib/supabase/admin";

export type LaunchCheck = {
  key: string;
  label: string;
  ok: boolean;
};

export async function getLaunchReadiness() {
  const checks: LaunchCheck[] = [
    {
      key: "site_url",
      label: "本番URL",
      ok: Boolean(process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://")),
    },
    {
      key: "operator_name",
      label: "運営者名",
      ok: Boolean(process.env.NEXT_PUBLIC_OPERATOR_NAME?.trim()),
    },
    {
      key: "support_email",
      label: "サポート窓口",
      ok: Boolean(process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.includes("@")),
    },
    {
      key: "supabase_url",
      label: "Supabase URL",
      ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    },
    {
      key: "supabase_publishable_key",
      label: "Supabase公開キー",
      ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    },
    {
      key: "supabase_server_secret",
      label: "Supabaseサーバーキー",
      ok: Boolean(
        process.env.SUPABASE_SECRET_KEY ??
          process.env.SUPABASE_SERVICE_ROLE_KEY,
      ),
    },
    {
      key: "cron_secret",
      label: "Cron認証",
      ok: Boolean(process.env.CRON_SECRET),
    },
  ];

  let databaseReady = false;

  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.SUPABASE_SECRET_KEY ??
      process.env.SUPABASE_SERVICE_ROLE_KEY)
  ) {
    try {
      const supabase = createAdminClient();
      const requiredTables = [
        "campaigns",
        "applications",
        "bookings",
        "deliverables",
        "payments",
        "booking_disputes",
        "creator_payout_profiles",
        "user_policy_acceptances",
      ] as const;

      const results = await Promise.all(
        requiredTables.map((table) =>
          supabase.from(table).select("*", { head: true }).limit(1),
        ),
      );

      databaseReady = results.every((result) => !result.error);
    } catch {
      databaseReady = false;
    }
  }

  const publicLaunchEnabled =
    process.env.PUBLIC_LAUNCH_ENABLED === "true";

  const approvalChecks: LaunchCheck[] = [
    {
      key: "legal_review",
      label: "法務レビュー",
      ok: process.env.LEGAL_REVIEW_COMPLETED === "true",
    },
    {
      key: "accounting_review",
      label: "会計・税務レビュー",
      ok: process.env.ACCOUNTING_REVIEW_COMPLETED === "true",
    },
    {
      key: "payout_security_review",
      label: "振込先情報のセキュリティレビュー",
      ok: process.env.PAYOUT_SECURITY_REVIEW_COMPLETED === "true",
    },
    {
      key: "rls_e2e",
      label: "実DB RLS負例テスト",
      ok: process.env.RLS_E2E_VERIFIED === "true",
    },
    {
      key: "pilot_e2e",
      label: "実有償PR E2E",
      ok: process.env.PILOT_E2E_COMPLETED === "true",
    },
  ];

  const environmentReady = checks.every((check) => check.ok);
  const approvalsReady = approvalChecks.every((check) => check.ok);

  return {
    checks,
    approvalChecks,
    environmentReady,
    approvalsReady,
    databaseReady,
    publicLaunchEnabled,
    ready:
      environmentReady &&
      approvalsReady &&
      databaseReady &&
      publicLaunchEnabled,
  };
}
