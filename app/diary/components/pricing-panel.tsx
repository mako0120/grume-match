import Link from "next/link";
import {
  currentDiaryPricing,
  formatDiaryYen,
  DIARY_BASE_POST_DESCRIPTION,
  videoIncludedPriceForFollowers,
} from "@/lib/diary/pricing";

// Public-facing source must not link to editing tools, unpublished designs,
// internal creative assets, or external editable portfolio documents.
export function DiaryPricingPanel() {
  const price = currentDiaryPricing();
  return (
    <div className="diary-portfolio-price">
      <div className="diary-portfolio-price-head">
        <div>
          <span className="diary-overline">DIRECT PR PRICE</span>
          <h3>1投稿から、<br />お店の魅力を届ける。</h3>
        </div>
        <p>制作費はInstagram投稿1件が基準です。画像の枚数別に値段は設定していません。</p>
      </div>
      <div className="diary-current-price">
        <div className="diary-current-price-main">
          <span>INSTAGRAM FEED / 1 POST</span>
          <strong>{formatDiaryYen(price.amountYen)}</strong>
          <p>Instagramフィード投稿1件の基本料金（税込）</p>
        </div>
        <div className="diary-current-price-details">
          <strong>制作内容</strong>
          <p>{DIARY_BASE_POST_DESCRIPTION}</p>
          <p>普段のInstagram投稿と同じスタイルで、料理・店内を撮影して制作します。画像枚数で料金は変わりません。追加の投稿・素材二次利用などは事前にご相談します。</p>
        </div>
      </div>
      <div className="diary-video-price">
        <div>
          <span>PHOTO + SHORT VIDEO</span>
          <strong>動画込みPR：{formatDiaryYen(videoIncludedPriceForFollowers(price.followers))}〜</strong>
          <p>動画の尺、投稿先、納品内容は契約前に相談して決定します。</p>
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
