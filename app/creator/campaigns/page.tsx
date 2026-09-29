import { CampaignCard } from "@/components/campaign-card";
import { demoCampaigns } from "@/lib/demo-data";

export default function CreatorCampaignListPage() {
  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">Creator</span>
      </header>

      <h1 className="page-title">PR案件を探す</h1>
      <p className="page-subtitle">
        食事提供とは別に、現金報酬が明示された案件を掲載します。
      </p>

      <section className="campaign-list" aria-label="PR案件一覧">
        {demoCampaigns.map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} />
        ))}
      </section>
    </main>
  );
}
