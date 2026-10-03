import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchReasons } from "@/components/match-reasons";
import { PerformanceChip } from "@/components/performance-summary";
import { RestaurantScheduleConfirm } from "@/components/restaurant-schedule-confirm";
import { inviteCreator } from "@/server/actions/matching";
import { getCampaignMatches } from "@/server/queries/matching";
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
  const [campaign, matches] = await Promise.all([
    getRestaurantCampaignApplications(id),
    getCampaignMatches(id),
  ]);

  if (!campaign) notFound();

  const performance = await getPerformanceSummaries(
    campaign.applications.map((application) => application.creatorId),
  );

  // Best fit first, so the first card is usually the one to accept.
  const applications = [...campaign.applications].sort(
    (a, b) =>
      (matches?.applicantMatches.get(b.creatorId)?.score ?? 0) -
      (matches?.applicantMatches.get(a.creatorId)?.score ?? 0),
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
        相性の良い順に並んでいます。採用と来店日時の確定は同じ操作で完了します。
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

      {applications.length ? (
        applications.map((application) => {
          const match = matches?.applicantMatches.get(application.creatorId);

          return (
            <RestaurantScheduleConfirm
              performance={
                <>
                  {match ? <MatchReasons match={match} /> : null}
                  <Link
                    className="applicant-performance"
                    href={`/restaurant/creators/${application.creatorId}`}
                  >
                    <PerformanceChip summary={performance.get(application.creatorId)} />
                    <span>実績を見る →</span>
                  </Link>
                </>
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
          );
        })
      ) : (
        <section className="section-card">
          <strong>確認待ちの応募はありません</strong>
          <p>新しい応募が届いた時だけ、ここに表示されます。</p>
        </section>
      )}

      {matches?.canInvite ? (
        <section className="dashboard-section">
          <div className="section-heading">
            <h2>おすすめCreator</h2>
            {matches.invitedCount ? (
              <span className="status-pill">招待済み {matches.invitedCount}人</span>
            ) : null}
          </div>
          <p className="field-help recommend-help">
            大阪での投稿実績・閲覧数・PR完了数・希望報酬から選んでいます。招待するとCreatorに通知が届き、案件一覧に「招待あり」と表示されます。
          </p>

          {matches.recommendations.length ? (
            <div className="recommend-list">
              {matches.recommendations.map(({ creator, match }) => (
                <article className="recommend-card" key={creator.id}>
                  <div className="recommend-head">
                    <Link href={`/restaurant/creators/${creator.id}`}>
                      <strong>{creator.displayName}</strong>
                      <span>{creator.baseArea}・実績を見る →</span>
                    </Link>
                    <form action={inviteCreator}>
                      <input name="campaignId" type="hidden" value={matches.campaignId} />
                      <input name="creatorId" type="hidden" value={creator.id} />
                      <button className="secondary-button" type="submit">
                        招待する
                      </button>
                    </form>
                  </div>
                  <MatchReasons match={match} />
                  <PerformanceChip summary={creator.performance} />
                </article>
              ))}
            </div>
          ) : (
            <section className="section-card">
              <p>今おすすめできるCreatorは全員招待済み、または応募済みです。</p>
            </section>
          )}
        </section>
      ) : null}
    </main>
  );
}
