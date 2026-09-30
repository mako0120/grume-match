import Link from "next/link";
import { notFound } from "next/navigation";
import { RestaurantScheduleConfirm } from "@/components/restaurant-schedule-confirm";
import { getRestaurantCampaignApplications } from "@/server/queries/restaurant-applications";

export default async function RestaurantApplicationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getRestaurantCampaignApplications(id);

  if (!campaign) notFound();

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">Restaurant</span>
      </header>

      <Link className="back-link" href="/restaurant/campaigns/new">
        ← 新しい案件を作る
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

      {campaign.applications.length ? (
        campaign.applications.map((application) => (
          <RestaurantScheduleConfirm
            applicationId={application.applicationId}
            campaignId={campaign.campaignId}
            cashReward={campaign.cashReward}
            choices={application.choices}
            creatorName={application.creatorName}
            followerCount={application.followerCount}
            key={application.applicationId}
            partySize={application.partySize}
            slots={campaign.slots}
          />
        ))
      ) : (
        <section className="section-card">
          <strong>まだ応募者はいません</strong>
          <p>Creatorが来店候補日時を選んで応募すると、ここに表示されます。</p>
        </section>
      )}
    </main>
  );
}
