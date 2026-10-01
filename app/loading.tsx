export default function Loading() {
  return (
    <main className="creator-shell" aria-busy="true" aria-live="polite">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">読み込み中</span>
      </header>

      <div className="loading-stack">
        <div className="loading-line wide" />
        <div className="loading-line medium" />
        <div className="loading-card" />
        <div className="loading-card" />
      </div>
    </main>
  );
}
