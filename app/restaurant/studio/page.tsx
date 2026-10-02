import Link from "next/link";
import { UgcAssetGrid } from "@/components/ugc-asset-grid";
import { UsageLicenseSummary } from "@/components/usage-license-summary";
import { listRestaurantLibrary } from "@/server/queries/studio-library";

export default async function RestaurantStudioPage() {
  const library = await listRestaurantLibrary();

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">Restaurant</span>
      </header>

      <Link className="back-link" href="/restaurant">
        ← ホーム
      </Link>

      <span className="eyebrow">STUDIO</span>
      <h1 className="page-title">素材ライブラリ</h1>
      <p className="page-subtitle">
        承認したUGC写真・動画を、契約した範囲と期間の中で利用できます。期限を過ぎた素材は開けなくなります。
      </p>

      {!library ? (
        <section className="section-card">
          <strong>店舗登録が必要です</strong>
          <p>店舗情報を登録すると素材ライブラリを利用できます。</p>
        </section>
      ) : library.length === 0 ? (
        <section className="section-card">
          <strong>まだ素材はありません</strong>
          <p>
            案件作成時に「UGC写真・縦動画（納品）」と二次利用条件を選ぶと、承認した素材がここに集まります。
          </p>
        </section>
      ) : (
        <div className="studio-library">
          {library.map((entry) => (
            <article className="studio-entry" key={entry.bookingId}>
              <Link className="studio-entry-head" href={`/restaurant/bookings/${entry.bookingId}`}>
                <div>
                  <strong>{entry.creatorName}</strong>
                  <p>{entry.campaignTitle}</p>
                </div>
                <span>→</span>
              </Link>

              {entry.license ? <UsageLicenseSummary license={entry.license} /> : null}

              {entry.assets.length ? (
                <UgcAssetGrid assets={entry.assets} showDownload={entry.state !== "expired"} />
              ) : null}

              {entry.reviewing ? (
                <div className="pending-box">確認待ちの素材があります。来店詳細から承認してください。</div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
