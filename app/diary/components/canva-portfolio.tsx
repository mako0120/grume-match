import Link from "next/link";
import { DIARY_CAROUSEL_PRICE_GUIDE, DIARY_PORTFOLIO } from "@/lib/diary/portfolio";

export function CanvaPortfolio({ pricing = false }: { pricing?: boolean }) {
  return (
    <div className="diary-portfolio">
      <div className="diary-portfolio-grid">
        {DIARY_PORTFOLIO.map((work) => (
          <article className="diary-work-card" key={work.id}>
            <div className="diary-work-cover">
              <div className="diary-work-cover-meta"><span>{work.area}</span><span>GOURMET DIARY / OSAKA</span></div>
              <div className="diary-work-cover-type">{work.type}</div>
              <strong>{work.name}</strong>
              <span className="diary-work-cover-hook">{work.hook}</span>
              <span className="diary-work-cover-number">{work.pages}<small> PAGES</small></span>
              <div className="diary-work-cover-foot">CANVA WORK SAMPLE / {work.no}</div>
            </div>
            <div className="diary-work-card-info">
              <div className="diary-work-card-top"><span>WORK {work.no}</span><span>{work.pages}ページ構成</span></div>
              <h3>{work.name}</h3>
              <p>{work.lead}</p>
              <ul>{work.focus.map((point) => <li key={point}>{point}</li>)}</ul>
              <a href={work.viewUrl} target="_blank" rel="noopener noreferrer" className="diary-work-link" aria-label={work.name + "のCanva制作物を閲覧する"}>実際のCanva制作物を見る <span>↗</span></a>
            </div>
          </article>
        ))}
      </div>
      <p className="diary-portfolio-note">掲載内容はグルメ日誌の実際のCanva制作例です。表紙部分はサイト用の文字プレビューで、Canva原本の画像を複製したものではありません。上のリンクから全ページを確認できます。すべてを有償PR実績とするものではありません。リンク先は閲覧権限によって表示できない場合があります。</p>
      {pricing && (
        <section className="diary-portfolio-price" aria-label="フィード投稿参考料金">
          <div className="diary-portfolio-price-head">
            <div><span className="diary-overline">FEE GUIDELINE</span><h3>制作枚数から選べる、<br />フィードPRの料金目安。</h3></div>
            <p>一律料金ではなく、紹介する料理の種類と制作枚数に合わせてお見積もりします。</p>
          </div>
          <div className="diary-portfolio-price-grid">
            {DIARY_CAROUSEL_PRICE_GUIDE.map((tier) => (
              <div key={tier.label} className="diary-price-tier">
                <span>{tier.label} / {tier.pages}</span>
                <strong>{tier.min === tier.max ? tier.min.toLocaleString("ja-JP") : tier.min.toLocaleString("ja-JP") + "〜" + tier.max.toLocaleString("ja-JP")}<small>円（税込目安）</small></strong>
                <p>{tier.note}</p>
              </div>
            ))}
          </div>
          <p className="diary-price-conditions">食事提供は制作報酬とは別条件です。交通費、素材の別途納品、広告転用・二次利用、追加修正等は個別に確認します。掲載価格は参考であり、正式なお見積もりで確定します。再生数・保存数・来店数の保証はありません。</p>
          <Link href="/diary/request?service=instagram_feed" className="diary-button diary-button-primary">フィード投稿のPRを相談する <span>↗</span></Link>
        </section>
      )}
    </div>
  );
}
