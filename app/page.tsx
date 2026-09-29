import Link from "next/link";

export default function HomePage() {
  return (
    <main className="site-shell">
      <section className="hero-panel">
        <span className="eyebrow">GOURMET DIARY</span>
        <h1>飲食店PRを、DMから解放する。</h1>
        <p>
          有償PR案件を探し、来店できる日時をタップして応募。
          店舗も候補日時をタップするだけで採用と予約を同時に確定できます。
        </p>
        <div className="hero-actions">
          <Link className="primary-button" href="/creator/campaigns">
            Creatorとして案件を見る
          </Link>
          <span className="status-pill">MVP foundation</span>
        </div>
      </section>

      <section className="feature-grid" aria-label="主要機能">
        <article className="feature-card">
          <strong>MARKET</strong>
          <p>現金報酬が明示されたPR案件へ応募。</p>
        </article>
        <article className="feature-card">
          <strong>TAP SCHEDULE</strong>
          <p>候補日時を文章ではなくタップで選択。</p>
        </article>
        <article className="feature-card">
          <strong>OPERATOR ZERO</strong>
          <p>通常運用を自動化し、運営は例外だけ対応。</p>
        </article>
      </section>
    </main>
  );
}
