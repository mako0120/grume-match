"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">ERROR</span>
      </header>

      <section className="section-card error-state-card">
        <span className="eyebrow">RETRY</span>
        <h1>うまく読み込めませんでした</h1>
        <p>
          通信状況を確認して、もう一度お試しください。入力中の操作は重複送信しないよう保護しています。
        </p>
        <button className="primary-button" onClick={reset} type="button">
          もう一度試す
        </button>
      </section>
    </main>
  );
}
