import {
  formatCompactViews,
  formatPercent,
  performancePlatformLabels,
  type PerformancePlatform,
  type PerformanceSummary,
} from "@/lib/creator-performance";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "UTC",
  month: "numeric",
  day: "numeric",
});

function dateLabel(isoDate: string) {
  return dateFormatter.format(new Date(isoDate + "T00:00:00Z"));
}

function platformLabel(platform: string) {
  return performancePlatformLabels[platform as PerformancePlatform] ?? platform;
}

export function VerificationBadge({ verified }: { verified: PerformanceSummary["verified"] }) {
  return verified === "all" ? (
    <span className="status-chip status-approved">運営確認済み</span>
  ) : verified === "partial" ? (
    <span className="status-chip">一部確認済み</span>
  ) : (
    <span className="status-chip">自己申告</span>
  );
}

/** One line for lists: applicants, Direct OFFER picker. */
export function PerformanceChip({ summary }: { summary: PerformanceSummary | null | undefined }) {
  if (!summary) {
    return <span className="performance-chip is-empty">実績未登録</span>;
  }

  const approx = summary.viewsApprox ? "約" : "";

  return (
    <span className="performance-chip">
      30日 {approx}
      {formatCompactViews(summary.totalViews)}閲覧・中央値{formatCompactViews(summary.medianViews)}
      ・反応率{formatPercent(summary.engagementRate)}
      {summary.verified === "all" ? "・確認済" : ""}
      {summary.stale ? "・更新待ち" : ""}
    </span>
  );
}

export function PerformanceSummaryCard({
  summary,
  showPosts = true,
  postLimit = 10,
}: {
  summary: PerformanceSummary;
  showPosts?: boolean;
  postLimit?: number;
}) {
  const approx = summary.viewsApprox ? "約" : "";

  return (
    <section className="performance-card">
      <div className="performance-head">
        <div>
          <span className="eyebrow">LAST 30 DAYS</span>
          <h2>過去30日の実績</h2>
          <p>
            {platformLabel(summary.platform)}・{dateLabel(summary.windowStart)}〜
            {dateLabel(summary.measuredOn)}の投稿（{dateLabel(summary.measuredOn)}時点）
          </p>
        </div>
        <VerificationBadge verified={summary.verified} />
      </div>

      {summary.stale ? (
        <div className="form-message">
          最終更新から35日以上たっています。最新のインサイトで更新してください。
        </div>
      ) : null}

      <div className="performance-hero">
        <span>合計閲覧数</span>
        <strong>
          {approx}
          {formatCompactViews(summary.totalViews)}
        </strong>
        <small>{summary.postCount}投稿</small>
      </div>

      <dl className="performance-grid">
        <div>
          <dt>中央値/投稿</dt>
          <dd>{formatCompactViews(summary.medianViews)}</dd>
        </div>
        <div>
          <dt>平均</dt>
          <dd>{formatCompactViews(summary.averageViews)}</dd>
        </div>
        <div>
          <dt>最高</dt>
          <dd>{formatCompactViews(summary.maxViews)}</dd>
        </div>
        <div>
          <dt>1万閲覧超え</dt>
          <dd>
            {summary.postsOver10k}/{summary.postCount}本
          </dd>
        </div>
        <div>
          <dt>いいね</dt>
          <dd>{summary.totalLikes.toLocaleString("ja-JP")}</dd>
        </div>
        <div>
          <dt>反応率</dt>
          <dd>{formatPercent(summary.engagementRate)}</dd>
        </div>
      </dl>

      <ul className="performance-highlights">
        {summary.highlights.map((highlight) => (
          <li key={highlight}>{highlight}</li>
        ))}
      </ul>

      <div className="performance-areas" aria-label="エリア別">
        {summary.areas.map((area) => (
          <span className="meta-pill" key={area.area}>
            {area.area} {formatCompactViews(area.views)}
          </span>
        ))}
      </div>

      {showPosts ? (
        <ol className="performance-posts">
          {summary.posts.slice(0, postLimit).map((post, index) => {
            const body = (
              <>
                <span className="performance-rank">{index + 1}</span>
                <div>
                  <strong>
                    {post.area}
                    {post.headline ? `｜${post.headline}` : ""}
                  </strong>
                  <p>
                    ♡{post.likes.toLocaleString("ja-JP")}・コメント{post.comments}・リポスト
                    {post.reposts}・シェア{post.shares}・{dateLabel(post.postedOn)}
                    {post.postedOnApprox ? "頃" : ""}投稿
                  </p>
                </div>
                <span className="performance-views">
                  {post.viewsApprox ? "約" : ""}
                  {formatCompactViews(post.views)}
                </span>
              </>
            );

            return (
              <li key={`${post.area}-${post.postedOn}-${index}`}>
                {post.postUrl ? (
                  <a href={post.postUrl} rel="noopener noreferrer" target="_blank">
                    {body}
                  </a>
                ) : (
                  <div>{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}

      <p className="performance-note">
        反応率＝（いいね＋コメント＋リポスト＋シェア）÷閲覧数。
        {summary.viewsApprox ? "「約」はアプリの万単位表示から入力した概数です。" : ""}
        {summary.verified === "all" ? "" : "数値はCreatorの自己申告です。"}
      </p>
    </section>
  );
}
