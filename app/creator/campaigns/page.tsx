import Link from "next/link";
import { CampaignCard } from "@/components/campaign-card";
import { listCreatorCampaigns } from "@/server/queries/campaigns";
import { getCreatorStandbyStatus } from "@/server/queries/standby";

export default async function CreatorCampaignListPage() {
  const [campaigns, standby] = await Promise.all([
    listCreatorCampaigns(),
    getCreatorStandbyStatus(),
  ]);

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
        食事提供とは別に、現金報酬が明示された案件を掲載します。
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
            <CampaignCard key={campaign.id} campaign={campaign} />
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
