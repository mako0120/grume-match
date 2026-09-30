import Link from "next/link";
import { notFound } from "next/navigation";
import { TapSchedule } from "@/components/tap-schedule";
import { getCreatorCampaign } from "@/server/queries/campaigns";

const platformLabels: Record<string, string> = {
  instagram_feed: "Instagram Feed",
  instagram_reel: "Instagram Reel",
  instagram_story: "Instagram Story",
  tiktok: "TikTok",
  youtube_shorts: "YouTube Shorts",
  ugc_photo: "UGC写真",
  ugc_video: "UGC動画",
};

export default async function CreatorCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCreatorCampaign(id);

  if (!campaign) notFound();

  return (
    <main className="creator-shell">
      <Link className="back-link" href="/creator/campaigns">
        ← 案件一覧
      </Link>

      {campaign.visibility === "direct" ? (
        <section className="direct-offer-notice">
          <span className="eyebrow">PRIVATE PAID OFFER</span>
          <strong>この案件は、店舗からあなた1人へ送られた指名オファーです。</strong>
        </section>
      ) : null}

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
          <strong>
            {campaign.platforms.map((platform) => platformLabels[platform] ?? platform).join(" / ")}
          </strong>
        </div>
        <div className="summary-item">
          <span>来店人数</span>
          <strong>
            {campaign.maxCompanions === 0
              ? "1名限定・ひとりで参加OK"
              : `1名からOK・最大${campaign.maxCompanions + 1}名`}
          </strong>
        </div>
      </section>

      {campaign.slots.length > 0 ? (
        <TapSchedule
          campaignId={campaign.id}
          maxCompanions={campaign.maxCompanions}
          slots={campaign.slots}
        />
      ) : (
        <section className="section-card">
          <strong>現在選択できる来店枠がありません</strong>
          <p>店舗が新しい枠を公開すると応募できます。</p>
        </section>
      )}
    </main>
  );
}
