import Link from "next/link";
import { campaignStatusLabels } from "@/lib/status-labels";
import { closeCampaignRecruitment } from "@/server/actions/campaigns";
import { getRestaurantDashboard } from "@/server/queries/restaurant-dashboard";

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function RestaurantDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; status?: string }>;
}) {
  const { message, status } = await searchParams;
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
        <Link className="header-action" href="/account">
          設定
        </Link>
      </header>

      <span className="eyebrow">RESTAURANT DASHBOARD</span>
      <h1 className="page-title">{restaurant?.name ?? "店舗管理"}</h1>
      <p className="page-subtitle">
        応募・来店・投稿確認など、次に対応するものから確認できます。
      </p>

      {message ? (
        <div
          className={status === "error" ? "form-message error-message" : "form-message inline-success"}
          aria-live="polite"
        >
          {message}
        </div>
      ) : null}

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>今やること</h2>
          <span className="status-pill">{dashboard.tasks.length}件</span>
        </div>

        {dashboard.tasks.length ? (
          <div className="task-list">
            {dashboard.tasks.slice(0, 8).map((task) => (
              <Link className="task-card" href={task.href} key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <p>{task.detail}</p>
                </div>
                <span>→</span>
              </Link>
            ))}
          </div>
        ) : (
          <section className="section-card">
            <strong>今すぐ対応することはありません</strong>
            <p>通常案件は自動で進みます。対応が必要な時だけここに表示します。</p>
          </section>
        )}
      </section>

      <section className="dashboard-metrics">
        <Link href="/restaurant/campaigns/new">
          <span>募集中</span>
          <strong>{dashboard.counts.recruiting}</strong>
        </Link>
        <div>
          <span>応募確認</span>
          <strong>{dashboard.counts.applications}</strong>
        </div>
        <Link href="/restaurant/bookings">
          <span>来店予定</span>
          <strong>{dashboard.counts.upcoming}</strong>
        </Link>
        <div>
          <span>投稿確認</span>
          <strong>{dashboard.counts.deliverables}</strong>
        </div>
        <Link href="/restaurant/reschedules">
          <span>日時変更</span>
          <strong>{dashboard.counts.reschedules}</strong>
        </Link>
      </section>

      <nav className="dashboard-links" aria-label="効果と素材">
        <Link href="/restaurant/signal">
          <span className="eyebrow">SIGNAL</span>
          <strong>PR効果</strong>
          <small>閲覧・来店と費用対効果</small>
        </Link>
        <Link href="/restaurant/studio">
          <span className="eyebrow">STUDIO</span>
          <strong>素材ライブラリ</strong>
          <small>UGC写真・動画と利用期限</small>
        </Link>
      </nav>

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>案件</h2>
          <Link href="/restaurant/campaigns/new">＋ 新規作成</Link>
        </div>

        {dashboard.campaigns.length ? (
          <div className="campaign-list">
            {dashboard.campaigns.map((campaign) => (
              <article className="campaign-management-card" key={campaign.id}>
                <Link
                  className="booking-card campaign-management-link"
                  href={`/restaurant/campaigns/${campaign.id}/applications`}
                >
                  <div>
                    <span className="meta-pill">
                      {campaignStatusLabels[campaign.status] ?? campaign.status}
                    </span>
                    <h2>{campaign.title}</h2>
                    <p>募集 {campaign.creator_slots}名</p>
                  </div>
                  <div className="booking-money">
                    ¥{Number(campaign.cash_reward).toLocaleString()}
                    <small>Creator報酬</small>
                  </div>
                </Link>

                {["published", "recruiting"].includes(campaign.status) ? (
                  <form action={closeCampaignRecruitment}>
                    <input name="campaignId" type="hidden" value={campaign.id} />
                    <button className="text-button campaign-close-button" type="submit">
                      募集を終了
                    </button>
                  </form>
                ) : null}
              </article>
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
