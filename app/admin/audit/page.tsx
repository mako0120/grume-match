import Link from "next/link";
import { listAdminAuditLog } from "@/server/queries/admin-audit";

export default async function AdminAuditPage() {
  const rows = await listAdminAuditLog();

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <nav className="mini-nav">
          <Link href="/admin">Inbox</Link>
          <Link href="/admin/payments">報酬支払い</Link>
        </nav>
      </header>

      <h1 className="page-title">監査ログ</h1>
      <p className="page-subtitle">
        重要な状態変更を新しい順に確認できます。通常運用では編集しません。
      </p>

      {rows.length ? (
        <section className="campaign-list">
          {rows.map((row) => (
            <article className="booking-card" key={row.id}>
              <div>
                <span className="meta-pill">{row.actor_role ?? "system"}</span>
                <h2>{row.action}</h2>
                <p>
                  {row.entity_type}
                  {row.entity_id ? "・" + row.entity_id : ""}
                </p>
              </div>
              <div className="booking-money audit-time">
                {row.createdLabel}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="section-card">
          <strong>監査ログはまだありません</strong>
          <p>案件操作が行われるとここに記録されます。</p>
        </section>
      )}
    </main>
  );
}
