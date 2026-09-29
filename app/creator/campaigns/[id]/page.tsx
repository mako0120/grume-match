import Link from "next/link";
import { notFound } from "next/navigation";
import { TapSchedule } from "@/components/tap-schedule";
import { getDemoCampaign } from "@/lib/demo-data";

export default async function CreatorCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = getDemoCampaign(id);

  if (!campaign) notFound();

  return (
    <main className="creator-shell">
      <Link className="back-link" href="/creator/campaigns">
        ← 案件一覧
      </Link>

      <section className="detail-hero">
        <span>{campaign.area}・{campaign.category}</span>
        <h1>{campaign.title}</h1>
        <div className="reward">
          ¥{campaign.cashReward.toLocaleString()}
          <small style={{ color: "rgba(255,255,255,.75)" }}>現金報酬</small>
        </div>
      </section>

      <section className="summary-grid">
        <div className="summary-item">
          <span>店舗</span>
          <strong>{campaign.restaurantName}</strong>
        </div>
        <div className="summary-item">
          <span>提供</span>
          <strong>{campaign.foodOffer}</strong>
        </div>
        <div className="summary-item">
          <span>来店期間</span>
          <strong>{campaign.visitPeriod}</strong>
        </div>
        <div className="summary-item">
          <span>必須投稿</span>
          <strong>Instagram Reel</strong>
        </div>
      </section>

      {campaign.slots.length > 0 ? (
        <TapSchedule
          maxCompanions={campaign.maxCompanions}
          slots={campaign.slots}
        />
      ) : (
        <section className="section-card">
          <strong>来店枠を準備中です</strong>
          <p>店舗が公開した日時だけを選択できる設計です。</p>
        </section>
      )}
    </main>
  );
}
