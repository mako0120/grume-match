import Link from "next/link";
import { notFound } from "next/navigation";
import { RestaurantScheduleConfirm } from "@/components/restaurant-schedule-confirm";
import { PerformanceChip } from "@/components/performance-summary";
import { getPerformanceSummaries } from "@/server/queries/performance";
import { getRestaurantCampaignApplications } from "@/server/queries/restaurant-applications";

export default async function RestaurantApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { id } = await params;
  const { message } = await searchParams;
  const campaign = await getRestaurantCampaignApplications(id);

  if (!campaign) notFound();

  const performance = await getPerformanceSummaries(
    campaign.applications.map((application) => application.creatorId),
  );

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">Restaurant</span>
      </header>

      <Link className="back-link" href="/restaurant">
        ← 店舗ホーム
      </Link>

      <h1 className="page-title">応募者を選ぶ</h1>
      <p className="page-subtitle">
        採用と来店日時の確定を同じ操作で完了させます。
      </p>

      {message ? (
        <div className="form-message inline-success" aria-live="polite">
          {message}
        </div>
      ) : null}

      <section className="section-card restaurant-campaign-summary">
        <span className="eyebrow">CAMPAIGN</span>
        <h2>{campaign.restaurantName}</h2>
        <p>{campaign.title}</p>
      </section>

      {campaign.applications.length ? (
        campaign.applications.map((application) => (
          <RestaurantScheduleConfirm
            performance={
              <Link
                className="applicant-performance"
                href={`/restaurant/creators/${application.creatorId}`}
              >
                <PerformanceChip summary={performance.get(application.creatorId)} />
                <span>実績を見る →</span>
              </Link>
            }
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
          <strong>確認待ちの応募はありません</strong>
          <p>新しい応募が届いた時だけ、ここに表示されます。</p>
        </section>
      )}
    </main>
  );
}
