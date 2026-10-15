import Link from "next/link";
import { retryNotificationEmail } from "@/server/actions/email-outbox";
import { listFailedNotificationEmails } from "@/server/queries/admin-email-outbox";

export default async function AdminEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; status?: string }>;
}) {
  const { message, status } = await searchParams;
  const rows = await listFailedNotificationEmails();

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <nav className="mini-nav">
          <Link href="/admin">Inbox</Link>
          <Link href="/admin/readiness">商用化</Link>
          <Link href="/admin/audit">監査</Link>
        </nav>
      </header>

      <span className="eyebrow">EMAIL DELIVERY</span>
      <h1 className="page-title">通知メール</h1>
      <p className="page-subtitle">
        送信に失敗した通知だけを表示します。取引自体はメール失敗で巻き戻しません。
      </p>

      {message ? (
        <div
          aria-live="polite"
          className={status === "error" ? "form-message error-message" : "form-message inline-success"}
        >
          {message}
        </div>
      ) : null}

      {rows.length ? (
        <section className="campaign-list">
          {rows.map((row) => (
            <article className="payment-admin-card" key={row.id}>
              <div>
                <span className="meta-pill">送信エラー</span>
                <h2>{row.subject}</h2>
                <p>{row.emailLabel}</p>
                <p>試行 {row.attempts}回・次回候補 {row.retryLabel}</p>
              </div>

              {row.lastError ? (
                <div className="form-message">{row.lastError}</div>
              ) : null}

              <form action={retryNotificationEmail}>
                <input name="id" type="hidden" value={row.id} />
                <button className="secondary-button" type="submit">
                  再送待ちに戻す
                </button>
              </form>
            </article>
          ))}
        </section>
      ) : (
        <section className="section-card">
          <strong>メール配信エラーはありません</strong>
          <p>通常の通知は自動配信キューで処理されます。</p>
        </section>
      )}
    </main>
  );
}
