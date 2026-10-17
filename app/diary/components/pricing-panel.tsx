import Link from "next/link";
import {
  currentDiaryPricing,
  formatDiaryYen,
  DIARY_BASE_POST_DESCRIPTION,
  videoIncludedPriceForFollowers,
} from "@/lib/diary/pricing";

// The public site only links to Instagram. Do not embed Canva templates,
// internal creative files, unpublished designs or viewer links here.
export function DiaryPricingPanel() {
  const price = currentDiaryPricing();
  return (
    <div className="diary-portfolio-price">
      <div className="diary-portfolio-price-head">
        <div>
          <span className="diary-overline">DIRECT PR PRICE</span>
          <h3>グルメ日誌本人へのご依頼。<br />フィード投稿は {formatDiaryYen(price.amountYen)} から。</h3>
        </div>
        <p>仲介を挟まず直接ご相談いただけます。撮影内容・投稿範囲・修正回数は契約前にご確認いただきます。</p>
      </div>
      <div className="diary-current-price">
        <div className="diary-current-price-main">
          <span>INSTAGRAM FEED / 1 POST</span>
          <strong>{formatDiaryYen(price.amountYen)}</strong>
          <p>写真フィード投稿の基本料金（税込）</p>
        </div>
        <div className="diary-current-price-details">
          <strong>制作内容</strong>
          <p>{DIARY_BASE_POST_DESCRIPTION}</p>
          <p>写真枚数、料理紹介、撮影時間、修正・二次利用の範囲はご契約前に合意します。</p>
        </div>
      </div>
      <div className="diary-video-price">
        <div>
          <span>PHOTO + SHORT VIDEO</span>
          <strong>動画込みPR：{formatDiaryYen(videoIncludedPriceForFollowers(price.followers))}〜</strong>
          <p>動画の長さ、掲載先、制作点数は別途お見積もりします。</p>
        </div>
        <Link className="diary-button diary-button-primary" href="/diary/request?service=instagram_feed_video&intent=application">
          動画込みプランを相談する ↗
        </Link>
      </div>
      <p className="diary-price-conditions">
        交通費・食事の提供条件・追加制作・二次利用等は契約前に明示します。
        投稿公開後7日以内の後払いです。再生数・来店・売上を保証するものではありません。
      </p>
      <Link className="diary-button diary-button-primary" href="/diary/request?service=instagram_feed&intent=application">
        フィードPRを申し込む ↗
      </Link>
    </div>
  );
}
