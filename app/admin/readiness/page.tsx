import Link from "next/link";
import { getCommercialIntegrity } from "@/server/queries/commercial-integrity";
import { getLaunchReadiness } from "@/server/queries/launch-readiness";

export default async function AdminReadinessPage() {
  const [readiness, integrity] = await Promise.all([
    getLaunchReadiness(),
    getCommercialIntegrity(),
  ]);

  const rows = [
    ...readiness.checks,
    ...readiness.approvalChecks,
    {
      key: "commercial_integrity",
      label: "商用データ整合性",
      ok: integrity.available && integrity.ready,
    },
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
        <strong>
          {readiness.ready && integrity.available && integrity.ready
            ? "READY"
            : "NOT READY"}
        </strong>
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
        <strong>商用データ整合性</strong>
        {!integrity.available ? (
          <p>診断RPCを実行できません。最新migrationとAdmin権限を確認してください。</p>
        ) : integrity.items.every((item) => item.ok) ? (
          <p>現在検出されている商用データ不整合はありません。</p>
        ) : (
          <div className="campaign-list">
            {integrity.items
              .filter((item) => !item.ok)
              .map((item) => (
                <article className="booking-card" key={item.key}>
                  <div>
                    <span className="status-chip status-rejected">
                      {item.violations}件
                    </span>
                    <h2>{item.label}</h2>
                  </div>
                </article>
              ))}
          </div>
        )}
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
