import Link from "next/link";
import { CampaignCard } from "@/components/campaign-card";
import { listCreatorCampaigns } from "@/server/queries/campaigns";

export default async function CreatorOffersPage() {
  const offers = await listCreatorCampaigns("market", "direct");

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">DIRECT OFFER</span>
      </header>

      <Link className="back-link" href="/creator/campaigns">
        ← 通常案件
      </Link>

      <section className="direct-offer-hero creator-direct-hero">
        <span className="eyebrow">FOR YOU</span>
        <h1>あなたへの指名PR。</h1>
        <p>
          店舗があなた1人を指名して送った有償オファーです。
          条件を確認して、参加したい場合は来店可能時間をタップしてください。
        </p>
      </section>

      {offers.length ? (
        <section className="campaign-list">
          {offers.map((offer) => (
            <div className="direct-offer-card-wrap" key={offer.id}>
              <span className="direct-only-badge">あなた限定</span>
              <CampaignCard campaign={offer} />
            </div>
          ))}
        </section>
      ) : (
        <section className="section-card">
          <strong>現在、指名オファーはありません</strong>
          <p>
            店舗からあなた宛に有償PR依頼が届くと、この画面だけに表示されます。
          </p>
        </section>
      )}
    </main>
  );
}
