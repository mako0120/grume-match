import { costPerThousandViews, saveRate } from "@/lib/pr-feedback";
import { formatPercent, formatYen } from "@/lib/signal-metrics";
import type { PostReportRow } from "@/server/queries/pr-feedback";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
});

function count(value: number | null) {
  return value === null ? "—" : value.toLocaleString("ja-JP");
}

// Numbers read from the Creator's insights screenshot (運営確認済み).
export function PostReportCard({
  costYen,
  report,
}: {
  costYen?: number;
  report: PostReportRow;
}) {
  return (
    <div className="post-report">
      <div className="post-report-head">
        <strong>投稿レポート</strong>
        <span className="status-chip status-approved">
          運営確認済み{report.measuredOn ? `・${dateFormatter.format(new Date(report.measuredOn))}時点` : ""}
        </span>
      </div>
      <dl className="signal-row-metrics">
        <div>
          <dt>閲覧数</dt>
          <dd>{count(report.views)}</dd>
        </div>
        <div>
          <dt>閲覧した人</dt>
          <dd>{count(report.reach)}</dd>
        </div>
        <div>
          <dt>保存</dt>
          <dd>{count(report.saves)}</dd>
        </div>
        <div>
          <dt>いいね</dt>
          <dd>{count(report.likes)}</dd>
        </div>
        <div>
          <dt>シェア</dt>
          <dd>{count(report.shares)}</dd>
        </div>
        <div>
          <dt>フォロー</dt>
          <dd>{count(report.follows)}</dd>
        </div>
        <div>
          <dt>保存率</dt>
          <dd>{formatPercent(saveRate(report))}</dd>
        </div>
        {costYen !== undefined ? (
          <div>
            <dt>1,000閲覧あたり</dt>
            <dd>{formatYen(costPerThousandViews(costYen, report.views))}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
