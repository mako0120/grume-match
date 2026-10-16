import Link from "next/link";
import { reviewAccountClosure } from "@/server/actions/account-closure";
import { listPendingAccountClosures } from "@/server/queries/admin-account-closures";

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; status?: string }>;
}) {
  const { message, status } = await searchParams;
  const requests = await listPendingAccountClosures();

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <nav className="mini-nav">
          <Link href="/admin">Inbox</Link>
          <Link href="/admin/disputes">運営確認</Link>
          <Link href="/admin/audit">監査</Link>
        </nav>
      </header>

      <span className="eyebrow">ACCOUNT REVIEW</span>
      <h1 className="page-title">アカウント依頼</h1>
      <p className="page-subtitle">
        削除や停止の依頼は、取引記録を即時消去せず運営が確認して処理します。
      </p>

      {message ? (
        <div
          aria-live="polite"
          className={status === "error" ? "form-message error-message" : "form-message inline-success"}
        >
          {message}
        </div>
      ) : null}

      {requests.length ? (
        <section className="campaign-list">
          {requests.map((request) => {
            const user = one(request.users);

            return (
              <article className="payment-admin-card" key={request.id}>
                <div>
                  <span className="meta-pill">{user?.role ?? "user"}</span>
                  <h2>{user?.email ?? "メール不明"}</h2>
                  <p>受付: {request.createdLabel}</p>
                </div>

                {request.reason ? (
                  <section className="section-card">
                    <strong>依頼内容</strong>
                    <p>{request.reason}</p>
                  </section>
                ) : null}

                <form action={reviewAccountClosure} className="campaign-form">
                  <input name="requestId" type="hidden" value={request.id} />
                  <label>
                    運営メモ（任意）
                    <textarea
                      name="note"
                      placeholder="本人確認・未完了取引・保管が必要な記録など"
                      rows={2}
                    />
                  </label>
                  <div className="review-actions">
                    <button
                      className="secondary-button"
                      name="action"
                      type="submit"
                      value="dismiss"
                    >
                      対応不要として閉じる
                    </button>
                    <button
                      className="primary-button"
                      name="action"
                      type="submit"
                      value="suspend"
                    >
                      アカウントを停止
                    </button>
                  </div>
                </form>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="section-card">
          <strong>未対応のアカウント依頼はありません</strong>
          <p>依頼が届いた時だけここに表示されます。</p>
        </section>
      )}
    </main>
  );
}
