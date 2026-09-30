import Link from "next/link";
import { CampaignCard } from "@/components/campaign-card";
import { listCreatorCampaigns } from "@/server/queries/campaigns";

export default async function CreatorCampaignListPage() {
  const campaigns = await listCreatorCampaigns();

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <nav className="mini-nav">
          <Link href="/creator/flash">FLASH</Link>
          <Link href="/creator/applications">応募</Link>
          <Link href="/creator/bookings">マイ案件</Link>
          <Link href="/creator/wallet">報酬</Link>
        </nav>
      </header>

      <h1 className="page-title">PR案件を探す</h1>
      <p className="page-subtitle">
        食事提供とは別に、現金報酬が明示された案件を掲載します。
      </p>

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
