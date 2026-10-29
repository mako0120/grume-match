import Link from "next/link";
import {
  DIARY_RETAINER_PLANS, DIARY_RETAINER_COMMON_CONDITIONS,
} from "@/lib/diary/retainers";
import { formatDiaryYen } from "@/lib/diary/pricing";

/**
 * Monthly packages are requests for a negotiated engagement, NOT checkout or
 * auto-renewing subscriptions. No invoice/authorization is initiated here.
 */
export function DiaryRetainerPricing({ compact = false }: { compact?: boolean }) {
  return (
    <section className="diary-retainers" id="monthly-pr" aria-labelledby="monthly-pr-title">
      <div className="diary-v2-container">
        <div className="diary-v2-section-head">
          <div>
            <span className="diary-v2-section-label">MONTHLY PARTNERSHIP</span>
            <h2 id="monthly-pr-title">季節ごとのおいしさを、<br /><em>毎月届ける。</em></h2>
          </div>
          <p>1回きりのPRだけでなく、メニュー変更や季節の魅力を継続して発信したい店舗様へ。月ごとの制作内容と日程を事前にご相談します。</p>
        </div>
        <div className="diary-retainer-grid">
          {DIARY_RETAINER_PLANS.map((plan, index) => (
            <article className={"diary-retainer-card" + (index === 1 ? " diary-retainer-card-featured" : "")}
              key={plan.id}>
              <div className="diary-retainer-card-top">
                <span>{index === 0 ? "01 / PHOTO" : "02 / PHOTO + REEL"}</span>
                <span className="diary-retainer-pill">{index === 1 ? "動画も継続" : "月1回から"}</span>
              </div>
              <h3>{plan.name}</h3>
              <p>{plan.subtitle}</p>
              <div className="diary-retainer-price">
                <strong>{formatDiaryYen(plan.priceYenInclTax)}</strong><span>/ 月・税込</span>
              </div>
              <ul>{plan.features.map(feature => <li key={feature}>{feature}</li>)}</ul>
              <Link className="diary-retainer-cta"
                href={`/diary/request?service=${plan.id}&intent=application`}>
                継続プランを相談する <span aria-hidden="true">↗</span>
              </Link>
            </article>
          ))}
        </div>
        <div className="diary-retainer-conditions">
          <strong>継続プランのお約束</strong>
          <ul>{DIARY_RETAINER_COMMON_CONDITIONS
            .slice(0, compact ? 3 : undefined)
            .map(term => <li key={term}>{term}</li>)}</ul>
          {compact && <Link href="/diary/services#monthly-pr">契約・料金条件の詳細を見る ↗</Link>}
        </div>
      </div>
    </section>
  );
}
