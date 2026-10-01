import Link from "next/link";

export default function HomePage() {
  return (
    <main className="site-shell">
      <section className="hero-panel">
        <span className="eyebrow">GOURMET DIARY</span>
        <h1>飲食店PRを、DMから解放する。</h1>
        <p>
          現金報酬が明示されたPR案件を探して、来店できる時間をタップ。
          店舗も候補時間をタップするだけで、応募から来店確定まで進められます。
        </p>

        <div className="hero-actions">
          <Link className="primary-button" href="/signup">
            無料で始める
          </Link>
          <Link className="secondary-button" href="/login">
            ログイン
          </Link>
          <span className="status-pill">Osaka Alpha</span>
        </div>
      </section>

      <section className="feature-grid" aria-label="主要機能">
        <article className="feature-card">
          <strong>有償PR</strong>
          <p>食事提供とは別に、Creatorへの現金報酬を明示。</p>
        </article>

        <article className="feature-card">
          <strong>時間をタップ</strong>
          <p>DMでの日程調整を減らし、空いている時間から選択。</p>
        </article>

        <article className="feature-card">
          <strong>1人でもOK</strong>
          <p>Creator1名での参加と、1人運営の店舗・運営者を前提に設計。</p>
        </article>
      </section>
    </main>
  );
}
