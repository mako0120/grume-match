import Link from "next/link";
import { getLaunchReadiness } from "@/server/queries/launch-readiness";

export default async function AdminReadinessPage() {
  const readiness = await getLaunchReadiness();

  const rows = [
    ...readiness.checks,
    {
      key: "database_schema",
      label: "PR OSデータベース構成",
      ok: readiness.databaseReady,
    },
    {
      key: "public_launch",
      label: "一般公開フラグ",
      ok: readiness.publicLaunchEnabled,
    },
  ];

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <nav className="mini-nav">
          <Link href="/admin">Inbox</Link>
          <Link href="/admin/audit">監査</Link>
        </nav>
      </header>

      <span className="eyebrow">LAUNCH READINESS</span>
      <h1 className="page-title">商用化チェック</h1>
      <p className="page-subtitle">
        一般公開に必要な実環境だけを確認します。未完了がある状態では公開完了と扱いません。
      </p>

      <section className="admin-count">
        <span>状態</span>
        <strong>{readiness.ready ? "READY" : "NOT READY"}</strong>
      </section>

      <section className="campaign-list">
        {rows.map((row) => (
          <article className="booking-card" key={row.key}>
            <div>
              <span className={row.ok ? "status-chip status-approved" : "status-chip status-rejected"}>
                {row.ok ? "完了" : "未完了"}
              </span>
              <h2>{row.label}</h2>
            </div>
          </article>
        ))}
      </section>

      <section className="section-card">
        <strong>次の基準</strong>
        <p>
          この画面がREADYになっても、実案件1件のE2E完了・RLS負例テスト・法務/会計確認までは一般公開しません。
        </p>
        <Link className="secondary-button" href="/admin/audit">
          監査ログを見る
        </Link>
      </section>
    </main>
  );
}
