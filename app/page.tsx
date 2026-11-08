import Link from "next/link";

export default function HomePage() {
  const publicLaunch = process.env.PUBLIC_LAUNCH_ENABLED === "true";

  return (
    <main className="site-shell">
      <section className="hero-panel">
        <span className="eyebrow">GOURMET DIARY</span>
        <h1>飲食店PRを、DMから解放する。</h1>
        <p>
          現金報酬が明示されたPR案件を探して、来店できる時間をタップ。
          店舗も候補時間をタップするだけで、応募から来店確定まで進められます。
        </p>

        <div className="feature-card" style={{ marginTop: 18, borderColor: "#c6b394", background: "#fff8ea" }}>
          <strong>グルメ日誌｜大阪に直接PRを依頼したい店舗様へ</strong>
          <p>グルメ日誌本人が撮影・制作・投稿まで対応。店舗様向けの専用相談窓口をご用意しています。</p>
          <Link className="primary-button" href="/diary" style={{ marginTop: 12 }}>グルメ日誌のPR相談サイトへ ↗</Link>
        </div>

        <div className="hero-actions">
          <Link className="primary-button" href="/signup">
            無料で始める
          </Link>
          <Link className="secondary-button" href="/login">
            ログイン
          </Link>
          <span className="status-pill">
            {publicLaunch ? "Public" : "Osaka Private Alpha"}
          </span>
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

      <footer className="site-footer">
        <Link href="/legal/terms">利用規約</Link>
        <Link href="/legal/privacy">プライバシー</Link>
        <Link href="/legal/pr-guidelines">PRガイドライン</Link>
        <Link href="/legal/operator">運営者情報</Link>
        <Link href="/support">お問い合わせ</Link>
      </footer>
    </main>
  );
}
