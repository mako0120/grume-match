import Link from "next/link";
import { CampaignCard } from "@/components/campaign-card";
import { listCreatorCampaigns } from "@/server/queries/campaigns";
import { getMyCampaignMatches } from "@/server/queries/matching";
import { getCreatorStandbyStatus } from "@/server/queries/standby";

export default async function CreatorCampaignListPage() {
  const [listed, standby] = await Promise.all([
    listCreatorCampaigns(),
    getCreatorStandbyStatus(),
  ]);
  const matches = await getMyCampaignMatches(listed);

  // Invitations first, then the best fit for me, then newest.
  const campaigns = [...listed].sort((a, b) => {
    const left = matches.get(a.id);
    const right = matches.get(b.id);
    return (
      Number(Boolean(right?.invited)) - Number(Boolean(left?.invited)) ||
      Number(Boolean(left?.blocked)) - Number(Boolean(right?.blocked)) ||
      (right?.score ?? 0) - (left?.score ?? 0)
    );
  });

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <div className="header-actions">
          <Link className="header-action" href="/notifications">
            通知
          </Link>
          <Link className="header-action" href="/account">
            設定
          </Link>
        </div>
      </header>

      <h1 className="page-title">PR案件を探す</h1>
      <p className="page-subtitle">
        あなたの実績エリア・希望報酬に合う順に並んでいます。食事招待（現金報酬なし）と現金報酬つきの案件があります。
      </p>

      <Link className="quick-status-link" href="/creator/applications">
        応募状況を確認 →
      </Link>

      <Link
        className={standby?.active ? "standby-quick active" : "standby-quick"}
        href="/creator/standby"
      >
        <div>
          <span className={standby?.active ? "standby-dot active" : "standby-dot"} />
          <div>
            <strong>{standby?.active ? "今行ける：ON" : "今行ける：OFF"}</strong>
            <p>
              {standby?.active
                ? "FLASHが出たら通知します"
                : "急なPRに行ける時だけON"}
            </p>
          </div>
        </div>
        <span>変更 →</span>
      </Link>

      {campaigns.length ? (
        <section className="campaign-list" aria-label="PR案件一覧">
          {campaigns.map((campaign) => (
            <CampaignCard campaign={campaign} key={campaign.id} match={matches.get(campaign.id)} />
          ))}
        </section>
      ) : (
        <section className="section-card">
          <strong>現在募集中の案件はありません</strong>
          <p>新しい有償PR案件が公開されると、ここに表示されます。</p>
        </section>
      )}
    </main>
  );
}
