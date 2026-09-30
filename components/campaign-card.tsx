import Link from "next/link";
import type { DemoCampaign } from "@/lib/domain/types";

export function CampaignCard({ campaign }: { campaign: DemoCampaign }) {
  return (
    <Link className="campaign-card" href={`/creator/campaigns/${campaign.id}`}>
      <div className="campaign-topline">
        <span className="meta-pill">{campaign.area}</span>
        <span className="meta-pill">{campaign.category}</span>
        {campaign.visibility === "direct" ? (
          <span className="meta-pill direct-pill">指名オファー</span>
        ) : null}
        <span className="meta-pill">募集 {campaign.creatorSlots}名</span>
        <span className="meta-pill solo-card-pill">
          {campaign.maxCompanions === 0 ? "1名限定" : "1名からOK"}
        </span>
      </div>

      <div>
        <h2>{campaign.restaurantName}</h2>
        <p>{campaign.title}</p>
      </div>

      <div className="reward">
        ¥{campaign.cashReward.toLocaleString()}
        <small>現金報酬</small>
      </div>

      <div className="campaign-meta">
        <span className="meta-pill">{campaign.foodOffer}</span>
        <span className="meta-pill">{campaign.visitPeriod}</span>
      </div>
    </Link>
  );
}
