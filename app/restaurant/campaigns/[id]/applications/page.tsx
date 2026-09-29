import Link from "next/link";
import { notFound } from "next/navigation";
import { RestaurantScheduleConfirm } from "@/components/restaurant-schedule-confirm";
import { getDemoCampaign } from "@/lib/demo-data";

export default async function RestaurantApplicationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = getDemoCampaign(id);

  if (!campaign) notFound();

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">Restaurant</span>
      </header>

      <Link className="back-link" href="/">
        ← プロダクトトップ
      </Link>

      <h1 className="page-title">応募者を選ぶ</h1>
      <p className="page-subtitle">
        採用と来店日時の確定を同じ操作で完了させます。
      </p>

      <section className="section-card restaurant-campaign-summary">
        <span className="eyebrow">CAMPAIGN</span>
        <h2>{campaign.restaurantName}</h2>
        <p>{campaign.title}</p>
      </section>

      <RestaurantScheduleConfirm
        cashReward={campaign.cashReward}
        choices={[
          { kind: "exact", slotId: "s3" },
          { kind: "exact", slotId: "s9" },
          { kind: "flexible", dateLabel: "10月11日（土）", after: "19:00" },
        ]}
        creatorName="グルメ日誌"
        followerCount={4000}
        partySize={2}
        slots={campaign.slots}
      />
    </main>
  );
}
