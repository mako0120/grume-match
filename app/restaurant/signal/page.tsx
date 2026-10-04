import Link from "next/link";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { costPerThousandViews, totalPostReports } from "@/lib/pr-feedback";
import {
  formatPercent,
  formatRoas,
  formatSignalCode,
  formatYen,
  SIGNAL_RETENTION_MONTHS,
} from "@/lib/signal-metrics";
import { recordSignalVisit, voidSignalVisit } from "@/server/actions/signal";
import { getRestaurantPostReports } from "@/server/queries/pr-feedback";
import {
  getRestaurantSignal,
  parseSignalPeriod,
  signalPeriods,
} from "@/server/queries/signal";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

function todayInTokyo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function RestaurantSignalPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; status?: string; period?: string }>;
}) {
  const { message, status, period: periodParam } = await searchParams;
  const period = parseSignalPeriod(periodParam);
  const signal = await getRestaurantSignal(period);

  if (!signal) {
    return (
      <main className="creator-shell">
        <section className="section-card">
          <strong>店舗登録が必要です</strong>
          <p>店舗情報を登録するとPR効果を確認できます。</p>
          <Link className="primary-button" href="/onboarding">
            店舗登録へ
          </Link>
        </section>
      </main>
    );
  }

  const { totals } = signal;
  const today = todayInTokyo();

  // Post views come from the Creators' insights screenshots (運営確認済み).
  const reports = await getRestaurantPostReports(signal.restaurantId);
  const postViews = (bookingId: string) => totalPostReports(reports.get(bookingId) ?? []);
  const reported = signal.creators.filter((row) => reports.has(row.bookingId));
  const postTotals = totalPostReports(reported.flatMap((row) => reports.get(row.bookingId) ?? []));
  const reportedCost = reported.reduce((sum, row) => sum + row.costYen, 0);

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">Restaurant</span>
      </header>

      <Link className="back-link" href="/restaurant">
        ← ホーム
      </Link>

      <span className="eyebrow">SIGNAL</span>
      <h1 className="page-title">PR効果</h1>
      <p className="page-subtitle">
        PR投稿が何人に見られたか、PRリンクの閲覧と来店、1件あたりの費用を確認できます。
      </p>

      {message ? (
        <div
          className={status === "error" ? "form-message error-message" : "form-message inline-success"}
          aria-live="polite"
        >
          {message}
        </div>
      ) : null}

      <nav className="period-tabs" aria-label="期間">
        {Object.entries(signalPeriods).map(([key, value]) => (
          <Link
            aria-current={key === period ? "page" : undefined}
            className={key === period ? "is-active" : undefined}
            href={`/restaurant/signal?period=${key}`}
            key={key}
          >
            {value.label}
          </Link>
        ))}
      </nav>

      <section className="signal-metrics">
        <div>
          <span>PR費用</span>
          <strong>{formatYen(totals.costYen)}</strong>
        </div>
        <div>
          <span>リンク閲覧</span>
          <strong>{totals.landingViews.toLocaleString()}</strong>
        </div>
        <div>
          <span>来店</span>
          <strong>
            {totals.visits.toLocaleString()}
            <small>{totals.visitGuests}名</small>
          </strong>
        </div>
        <div>
          <span>閲覧→来店</span>
          <strong>{formatPercent(totals.visitRate)}</strong>
        </div>
        <div>
          <span>来店単価</span>
          <strong>{formatYen(totals.costPerVisit)}</strong>
        </div>
        <div>
          <span>来店売上</span>
          <strong>{formatYen(totals.revenueYen)}</strong>
        </div>
        <div>
          <span>売上 ÷ 費用</span>
          <strong>{formatRoas(totals.roas)}</strong>
        </div>
      </section>
      <section className="signal-metrics">
        <div>
          <span>投稿の閲覧数</span>
          <strong>{postTotals.views.toLocaleString()}</strong>
        </div>
        <div>
          <span>閲覧した人</span>
          <strong>{postTotals.reach.toLocaleString()}</strong>
        </div>
        <div>
          <span>保存</span>
          <strong>{postTotals.saves.toLocaleString()}</strong>
        </div>
        <div>
          <span>1,000閲覧あたり</span>
          <strong>{formatYen(costPerThousandViews(reportedCost, postTotals.views))}</strong>
        </div>
      </section>
      <p className="field-help">
        投稿の閲覧数は、Creatorが送ったインサイト画面を運営が確認した数字です（{postTotals.posts}投稿分）。1,000閲覧あたりはレポートが届いたPRの費用で計算します。
      </p>
      <p className="field-help">
        PR費用はCreator報酬・二次利用料・手数料の合計です（食事提供の原価は含みません。完了前のPRは手数料を見込みで含めます）。期間内に来店日または計測があったPRを集計します。
      </p>

      <section className="form-section">
        <span className="eyebrow">RECORD</span>
        <h2>来店を記録</h2>
        <p className="field-help">
          来店したお客様から伝えられた8文字のPRコードを入力します。お客様の個人情報は入力しません。
        </p>

        <form action={recordSignalVisit} className="campaign-form signal-record-form">
          <label>
            PRコード
            <input
              autoCapitalize="characters"
              autoComplete="off"
              inputMode="text"
              maxLength={12}
              name="code"
              placeholder="ABCD-EFGH"
              required
            />
          </label>

          <div className="field-row">
            <label>
              人数（任意）
              <input inputMode="numeric" max="50" min="1" name="partySize" type="number" />
            </label>
            <label>
              来店売上（任意・税込）
              <input inputMode="numeric" min="0" name="revenueYen" step="1" type="number" />
            </label>
          </div>

          <label>
            日付
            <input defaultValue={today} max={today} name="occurredOn" type="date" />
          </label>

          <PendingSubmitButton idleLabel="記録する" pendingLabel="記録中..." />
        </form>
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>Creator別</h2>
          <span className="status-pill">{signal.creators.length}件</span>
        </div>

        {signal.creators.length ? (
          <div className="signal-creator-list">
            {signal.creators.map((row) => (
              <article className="signal-creator-card" key={row.trackingLinkId}>
                <div className="signal-creator-head">
                  <div>
                    <strong>{row.creatorName}</strong>
                    <p>{row.campaignTitle}</p>
                  </div>
                  <span className="meta-pill">
                    {row.disabled ? "停止中" : formatSignalCode(row.code)}
                  </span>
                </div>
                <dl className="signal-row-metrics">
                  <div>
                    <dt>投稿の閲覧</dt>
                    <dd>{reports.has(row.bookingId) ? postViews(row.bookingId).views.toLocaleString() : "未着"}</dd>
                  </div>
                  <div>
                    <dt>1,000閲覧あたり</dt>
                    <dd>{formatYen(costPerThousandViews(row.costYen, postViews(row.bookingId).views))}</dd>
                  </div>
                  <div>
                    <dt>リンク閲覧</dt>
                    <dd>{row.landingViews}</dd>
                  </div>
                  <div>
                    <dt>来店</dt>
                    <dd>{row.visits}</dd>
                  </div>
                  <div>
                    <dt>費用</dt>
                    <dd>{formatYen(row.costYen)}</dd>
                  </div>
                  <div>
                    <dt>来店単価</dt>
                    <dd>{formatYen(row.costPerVisit)}</dd>
                  </div>
                  <div>
                    <dt>閲覧→来店</dt>
                    <dd>{formatPercent(row.visitRate)}</dd>
                  </div>
                  <div>
                    <dt>売上÷費用</dt>
                    <dd>{formatRoas(row.roas)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <section className="section-card">
            <strong>まだ計測対象のPRはありません</strong>
            <p>来店日時が確定すると、CreatorごとにPRリンクとPRコードが発行されます。</p>
          </section>
        )}
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>最近の記録</h2>
        </div>

        {signal.conversions.length ? (
          <ul className="signal-conversion-list">
            {signal.conversions.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>
                    来店
                    {item.partySize ? `・${item.partySize}名` : ""}
                    {item.revenueYen !== null ? `・${formatYen(item.revenueYen)}` : ""}
                  </strong>
                  <p>
                    {dateFormatter.format(new Date(item.occurredAt))}・{item.creatorName}・
                    {formatSignalCode(item.code)}
                  </p>
                </div>
                <form action={voidSignalVisit}>
                  <input name="eventId" type="hidden" value={item.id} />
                  <button className="text-button" type="submit">
                    取り消す
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <section className="section-card">
            <p>来店の記録はまだありません。</p>
          </section>
        )}
      </section>

      <section className="signal-privacy">
        <strong>計測範囲と保持期間</strong>
        <p>
          PRリンクのページでは表示回数だけを記録し、Cookie・IPアドレス・端末情報は保存しません。来店はPRコードと任意の人数・売上だけを記録します。記録は{SIGNAL_RETENTION_MONTHS}か月後に自動で削除されます。
        </p>
      </section>
    </main>
  );
}
