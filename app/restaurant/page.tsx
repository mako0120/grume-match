import Link from "next/link";
import { getRestaurantDashboard } from "@/server/queries/restaurant-dashboard";

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function RestaurantDashboardPage() {
  const dashboard = await getRestaurantDashboard();

  if (!dashboard) {
    return (
      <main className="creator-shell">
        <section className="section-card">
          <strong>店舗登録が必要です</strong>
          <p>PR案件を作成する前に店舗情報を登録してください。</p>
          <Link className="primary-button" href="/onboarding">
            店舗登録へ
          </Link>
        </section>
      </main>
    );
  }

  const restaurant = relationOne(dashboard.restaurant);

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <nav className="mini-nav">
          <Link href="/restaurant/campaigns/new">案件作成</Link>
          <Link href="/notifications">通知</Link>
        </nav>
      </header>

      <span className="eyebrow">RESTAURANT DASHBOARD</span>
      <h1 className="page-title">{restaurant?.name ?? "店舗管理"}</h1>
      <p className="page-subtitle">
        応募・来店・投稿確認など、次に対応するものから確認できます。
      </p>

      <section className="dashboard-metrics">
        <Link href="/restaurant/campaigns/new">
          <span>募集中</span>
          <strong>{dashboard.counts.recruiting}</strong>
        </Link>
        <div>
          <span>応募確認</span>
          <strong>{dashboard.counts.applications}</strong>
        </div>
        <div>
          <span>来店予定</span>
          <strong>{dashboard.counts.upcoming}</strong>
        </div>
        <div>
          <span>投稿確認</span>
          <strong>{dashboard.counts.deliverables}</strong>
        </div>
        <Link href="/restaurant/reschedules">
          <span>日時変更</span>
          <strong>{dashboard.counts.reschedules}</strong>
        </Link>
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>案件</h2>
          <Link href="/restaurant/campaigns/new">＋ 新規作成</Link>
        </div>

        {dashboard.campaigns.length ? (
          <div className="campaign-list">
            {dashboard.campaigns.map((campaign) => (
              <Link
                className="booking-card"
                href={`/restaurant/campaigns/${campaign.id}/applications`}
                key={campaign.id}
              >
                <div>
                  <span className="meta-pill">{campaign.status}</span>
                  <h2>{campaign.title}</h2>
                  <p>募集 {campaign.creator_slots}名</p>
                </div>
                <div className="booking-money">
                  ¥{Number(campaign.cash_reward).toLocaleString()}
                  <small>Creator報酬</small>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <section className="section-card">
            <strong>まだ案件はありません</strong>
            <p>最初の有償PR案件を公開してCreatorを募集できます。</p>
          </section>
        )}
      </section>
    </main>
  );
}
