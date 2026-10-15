import Link from "next/link";
import {
  suspendParticipant,
  verifyParticipant,
} from "@/server/actions/verification";
import { listUnverifiedParticipants } from "@/server/queries/admin-verification";

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function AdminVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; status?: string }>;
}) {
  const { message, status } = await searchParams;
  const { creators, restaurants } = await listUnverifiedParticipants();

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

      <span className="eyebrow">PARTICIPANT REVIEW</span>
      <h1 className="page-title">利用確認</h1>
      <p className="page-subtitle">
        有償PRを開始する前に、Creatorと店舗を運営が一度だけ確認します。
      </p>

      {message ? (
        <div
          aria-live="polite"
          className={
            status === "error"
              ? "form-message error-message"
              : "form-message inline-success"
          }
        >
          {message}
        </div>
      ) : null}

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>Creator</h2>
          <span className="status-pill">{creators.length}件</span>
        </div>

        {creators.length ? (
          <div className="campaign-list">
            {creators.map((creator) => {
              const user = relationOne(creator.users);
              const instagram = creator.creator_social_accounts?.find(
                (account) => account.platform === "instagram",
              );

              return (
                <article className="payment-admin-card" key={creator.id}>
                  <div>
                    <span className="meta-pill">Creator確認待ち</span>
                    <h2>{creator.display_name}</h2>
                    <p>{creator.base_area}</p>
                    <p>{user?.email ?? "メール不明"}</p>
                    {instagram ? (
                      <p>
                        @{instagram.handle}・
                        {Number(instagram.followers).toLocaleString()} followers
                      </p>
                    ) : (
                      <p>Instagram未登録</p>
                    )}
                  </div>

                  <form action={verifyParticipant}>
                    <input name="kind" type="hidden" value="creator" />
                    <input name="id" type="hidden" value={creator.id} />
                    <button className="primary-button" type="submit">
                      Creatorを確認済みにする
                    </button>
                  </form>

                  <details className="danger-details">
                    <summary>利用不可にする</summary>
                    <form action={suspendParticipant} className="danger-form">
                      <input name="kind" type="hidden" value="creator" />
                      <input name="id" type="hidden" value={creator.id} />
                      <label>
                        理由
                        <textarea name="reason" required rows={2} />
                      </label>
                      <button className="secondary-button" type="submit">
                        利用停止を確定
                      </button>
                    </form>
                  </details>
                </article>
              );
            })}
          </div>
        ) : (
          <section className="section-card">
            <strong>Creatorの確認待ちはありません</strong>
          </section>
        )}
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>店舗</h2>
          <span className="status-pill">{restaurants.length}件</span>
        </div>

        {restaurants.length ? (
          <div className="campaign-list">
            {restaurants.map((restaurant) => {
              const memberships = restaurant.restaurant_memberships ?? [];
              const ownerMembership =
                memberships.find((membership) => membership.role === "owner") ??
                memberships[0];
              const owner = relationOne(ownerMembership?.users);

              return (
                <article className="payment-admin-card" key={restaurant.id}>
                  <div>
                    <span className="meta-pill">店舗確認待ち</span>
                    <h2>{restaurant.name}</h2>
                    <p>{restaurant.area}</p>
                    <p>{restaurant.address}</p>
                    <p>{owner?.email ?? "担当メール不明"}</p>
                  </div>

                  <form action={verifyParticipant}>
                    <input name="kind" type="hidden" value="restaurant" />
                    <input name="id" type="hidden" value={restaurant.id} />
                    <button className="primary-button" type="submit">
                      店舗を確認済みにする
                    </button>
                  </form>

                  <details className="danger-details">
                    <summary>利用不可にする</summary>
                    <form action={suspendParticipant} className="danger-form">
                      <input name="kind" type="hidden" value="restaurant" />
                      <input name="id" type="hidden" value={restaurant.id} />
                      <label>
                        理由
                        <textarea name="reason" required rows={2} />
                      </label>
                      <button className="secondary-button" type="submit">
                        利用停止を確定
                      </button>
                    </form>
                  </details>
                </article>
              );
            })}
          </div>
        ) : (
          <section className="section-card">
            <strong>店舗の確認待ちはありません</strong>
          </section>
        )}
      </section>
    </main>
  );
}
