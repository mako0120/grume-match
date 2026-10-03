import type { ReactNode } from "react";
import { PerformanceSummaryCard } from "@/components/performance-summary";
import {
  costPerThousandViews,
  performancePlatformLabels,
  type PerformancePlatform,
  type PerformanceSummary,
} from "@/lib/creator-performance";
import type { SocialAccountSummary } from "@/server/queries/performance";

export function MediaKitView({
  displayName,
  baseArea,
  bio,
  minReward,
  accounts,
  summary,
  actions,
}: {
  displayName: string;
  baseArea: string;
  bio: string;
  minReward: number;
  accounts: SocialAccountSummary[];
  summary: PerformanceSummary | null;
  actions?: ReactNode;
}) {
  const cpm = summary ? costPerThousandViews(minReward, summary.medianViews) : null;

  return (
    <>
      <section className="booking-hero media-kit-hero">
        <span className="eyebrow">GOURMET CREATOR・{baseArea}</span>
        <h1>{displayName}</h1>
        {bio ? <p>{bio}</p> : null}
        {accounts.length ? (
          <div className="media-kit-accounts">
            {accounts.map((account) => (
              <a
                href={account.profileUrl}
                key={account.platform + account.handle}
                rel="noopener noreferrer"
                target="_blank"
              >
                {performancePlatformLabels[account.platform as PerformancePlatform] ??
                  account.platform}{" "}
                @{account.handle}
                {account.followers > 0
                  ? `・${account.followers.toLocaleString("ja-JP")}フォロワー`
                  : ""}
              </a>
            ))}
          </div>
        ) : null}
      </section>

      {summary ? (
        <PerformanceSummaryCard summary={summary} />
      ) : (
        <section className="section-card">
          <strong>実績はまだ登録されていません</strong>
          <p>Creatorがインサイトを登録すると、過去30日の閲覧数と反応が表示されます。</p>
        </section>
      )}

      {summary && minReward > 0 ? (
        <section className="section-card media-kit-pricing">
          <strong>報酬の目安</strong>
          <p>
            最低報酬 ¥{minReward.toLocaleString("ja-JP")}〜。1投稿あたりの閲覧数（中央値）で割ると、1,000閲覧あたり約¥
            {cpm?.toLocaleString("ja-JP")}です。実際の閲覧数は投稿内容や時期で変わります。
          </p>
        </section>
      ) : null}

      {actions}
    </>
  );
}
