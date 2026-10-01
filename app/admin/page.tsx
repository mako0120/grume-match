import Link from "next/link";
import { getAdminInbox } from "@/server/queries/admin-inbox";

const labels = {
  deliverable_overdue: "投稿",
  payment_overdue: "支払",
  payment_failed: "支払",
  dispute: "紛争",
  no_show: "来店",
} as const;

export default async function AdminPage() {
  const items = await getAdminInbox();

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <nav className="mini-nav">
          <Link href="/admin/payments">報酬支払い</Link>
          <Link href="/notifications">通知</Link>
        </nav>
      </header>

      <h1 className="page-title">今日あなたが対応すること</h1>
      <p className="page-subtitle">
        正常に進んでいる案件は表示せず、人間の判断が必要な例外だけを集めます。
      </p>

      <section className="admin-count">
        <span>要対応</span>
        <strong>{items.length}</strong>
        <small>件</small>
      </section>

      {items.length ? (
        <section className="admin-inbox">
          {items.map((item) => {
            const content = (
              <>
                <span className="meta-pill">{labels[item.kind]}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
                <span className="admin-arrow">→</span>
              </>
            );

            return item.href ? (
              <Link className="admin-item" href={item.href} key={item.id}>
                {content}
              </Link>
            ) : (
              <div className="admin-item" key={item.id}>{content}</div>
            );
          })}
        </section>
      ) : (
        <section className="section-card">
          <strong>要対応はありません</strong>
          <p>通常案件は自動運用中です。人間の仕事を増やさないことも、このプロダクトのKPIです。</p>
        </section>
      )}
    </main>
  );
}
