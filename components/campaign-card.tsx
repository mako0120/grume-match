import { formatReward } from "@/lib/pricing";
import Link from "next/link";
import { MatchReasons } from "@/components/match-reasons";
import type { DemoCampaign } from "@/lib/domain/types";
import type { MatchResult } from "@/lib/matching";

export function CampaignCard({
  campaign,
  match,
}: {
  campaign: DemoCampaign;
  match?: MatchResult & { invited: boolean };
}) {
  return (
    <Link className="campaign-card" href={`/creator/campaigns/${campaign.id}`}>
      <div className="campaign-topline">
        {match?.invited ? <span className="meta-pill invited-pill">招待あり</span> : null}
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
        {campaign.restaurantRating ? (
          <span className="rating-chip">Creator評価 {campaign.restaurantRating}</span>
        ) : null}
      </div>

      <div className="reward">
        {formatReward(campaign.cashReward)}
        <small>{campaign.cashReward > 0 ? "現金報酬＋食事" : "現金報酬なし"}</small>
      </div>

      {campaign.usageRights ? (
        <span className="meta-pill usage-pill">
          二次利用 {campaign.usageRights.durationDays}日
          {campaign.usageRights.fee > 0
            ? ` ＋¥${campaign.usageRights.fee.toLocaleString()}`
            : ""}
        </span>
      ) : null}

      {match ? <MatchReasons compact match={match} /> : null}

      <div className="campaign-meta">
        <span className="meta-pill">{campaign.foodOffer}</span>
        <span className="meta-pill">{campaign.visitPeriod}</span>
      </div>
    </Link>
  );
}
