import Link from "next/link";

export default function NotFound() {
  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">404</span>
      </header>

      <section className="section-card error-state-card">
        <span className="eyebrow">NOT FOUND</span>
        <h1>このページは見つかりません</h1>
        <p>URLが変更されたか、案件の募集が終了している可能性があります。</p>
        <Link className="primary-button" href="/">
          トップへ戻る
        </Link>
      </section>
    </main>
  );
}
