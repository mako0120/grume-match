import Link from "next/link";
import { DIARY_PORTFOLIO } from "@/lib/diary/portfolio";
import { currentDiaryPricing, formatDiaryYen, DIARY_BASE_POST_DESCRIPTION, videoIncludedPriceForFollowers } from "@/lib/diary/pricing";

export function CanvaPortfolio({ pricing = false }: { pricing?: boolean }) {
  const price = currentDiaryPricing();
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
        <section className="diary-portfolio-price" aria-label="グルメ日誌PR基本料金">
          <div className="diary-portfolio-price-head">
            <div><span className="diary-overline">DIRECT PR PRICE</span><h3>グルメ日誌本人への依頼なら、<br />今は1投稿 {formatDiaryYen(price.amountYen)}。</h3></div>
            <p>仲介会社を挟まない、グルメ日誌本人への直接依頼料金です。フォロワー増加とともに新規ご相談時の料金を改定する予定です。</p>
          </div>
          <div className="diary-current-price">
            <div className="diary-current-price-main">
              <span>INSTAGRAM FEED / 1 POST</span>
              <strong>{formatDiaryYen(price.amountYen)}</strong>
              <p>現在の基本料金・税込総額</p>
            </div>
            <div className="diary-current-price-details">
              <strong>基本サービス</strong>
              <p>{DIARY_BASE_POST_DESCRIPTION}</p>
              <p>投稿内の写真枚数・料理紹介の構成・撮影内容・修正範囲は事前に相談して決定します。</p>
            </div>
          </div>
          <div className="diary-video-price">
            <div><span>PHOTO + SHORT VIDEO</span><strong>動画込みPR：{formatDiaryYen(videoIncludedPriceForFollowers(price.followers))}〜</strong><p>写真のフィード投稿＋短い動画の制作。動画の尺、投稿形態、納品点数はお見積もり時に決定します。</p></div>
            <Link href="/diary/request?service=instagram_feed_video" className="diary-button diary-button-primary">動画込みプランを相談する ↗</Link>
          </div>
          <div className="diary-growth-price">
            <span>FOLLOWER MILESTONE</span>
            <strong>現在の実績：約{price.followers.toLocaleString("ja-JP")}フォロワー</strong>
            <p>{price.nextMilestone
              ? `次の料金見直し目安：${price.nextMilestone.toLocaleString("ja-JP")}フォロワー到達時（新規依頼から ${formatDiaryYen(price.nextAmountYen ?? price.amountYen)} を予定）`
              : "今後の料金は発信実績や制作工数を踏まえ、事前にご案内します。"}
            </p>
            <small>フォロワー数の確認日：{price.asOf}。将来の値上げ日・到達時期は確定していません。既に合意した案件の料金が後から変わることはありません。</small>
          </div>
          <p className="diary-price-conditions">基本料金以外に交通費・食事提供条件・撮影範囲・追加素材納品・二次利用等がある場合は、ご契約前に内容と金額を明示して合意します。動画込みPRは15,000円〜。リール単体・ストーリーズ単体や素材制作は個別お見積もりです。再生・来店・売上を保証するものではありません。</p>
          <Link href="/diary/request?service=instagram_feed" className="diary-button diary-button-primary">今の料金でフィードPRを相談する <span>↗</span></Link>
        </section>
      )}
    </div>
  );
}
