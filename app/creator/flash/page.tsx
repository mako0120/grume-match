import Link from "next/link";
import { CampaignCard } from "@/components/campaign-card";
import { listCreatorCampaigns } from "@/server/queries/campaigns";
import { getMyCampaignMatches } from "@/server/queries/matching";

export default async function CreatorFlashPage() {
  const listed = await listCreatorCampaigns("flash");
  const matches = await getMyCampaignMatches(
    listed.map((campaign) => ({ ...campaign, kind: "flash" as const })),
  );
  const campaigns = [...listed].sort(
    (a, b) => (matches.get(b.id)?.score ?? 0) - (matches.get(a.id)?.score ?? 0),
  );

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill flash-status">FLASH</span>
      </header>

      <Link className="back-link" href="/creator/campaigns">
        ← 通常案件
      </Link>

      <section className="flash-hero">
        <span className="eyebrow">GO NOW</span>
        <h1>今日行ける、有償PR。</h1>
        <p>
          直前の空席に対応できるCreator向けの緊急募集です。
          報酬と来店時間を確認して、そのまま応募できます。
        </p>
      </section>

      {campaigns.length ? (
        <section className="campaign-list">
          {campaigns.map((campaign) => (
            <CampaignCard campaign={campaign} key={campaign.id} match={matches.get(campaign.id)} />
          ))}
        </section>
      ) : (
        <section className="section-card">
          <strong>現在募集中のFLASHはありません</strong>
          <p>緊急案件が公開されるとここに表示されます。</p>
        </section>
      )}
    </main>
  );
}
