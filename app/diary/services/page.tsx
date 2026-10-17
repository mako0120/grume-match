import Link from "next/link";
import { PostShowcase } from "../components/post-showcase";
import { DiaryPricingPanel } from "../components/pricing-panel";
import { DiaryHeader, DiaryMobileCTA } from "../components/site-header";
import { currentDiaryPricing, formatDiaryYen, videoIncludedPriceForFollowers } from "@/lib/diary/pricing";

export const metadata = {
  title: "PRプラン・料金｜グルメ日誌｜大阪",
  description: "Instagramフィード1投稿の基本料金と、動画込みPRなどの制作内容。実際に公開されたInstagram投稿もご覧いただけます。",
};

const offerings = [
  {
    id: "instagram_feed",
    number: "01",
    category: "INSTAGRAM FEED",
    title: "写真フィードPR",
    description: "訪問・撮影・編集・キャプション作成から、Instagramフィード1投稿の公開まで。",
    includes: ["店舗を訪問して撮影", "写真の選定・編集", "キャプション・PR表記", "Instagramへのフィード投稿1件"],
    note: "投稿内の写真枚数に応じた料金設定はありません。紹介内容は事前に合意します。",
  },
  {
    id: "instagram_feed_video",
    number: "02",
    category: "PHOTO + SHORT VIDEO",
    title: "写真＋ショート動画",
    description: "Instagramフィード1投稿に、短い動画制作を組み合わせるプラン。",
    includes: ["訪問・写真と動画の撮影", "フィード投稿の編集・制作", "ショート動画制作", "公開先・尺・納品内容の相談"],
    note: "動画の投稿形態・制作尺・本数はご契約前に確認します。",
  },
  {
    id: "instagram_reel",
    number: "03",
    category: "INSTAGRAM REEL",
    title: "リール動画",
    description: "お店のライブ感や料理の臨場感を、ショート動画で表現します。",
    includes: ["撮影", "動画構成・編集", "テロップ・キャプション", "投稿内容の確認"],
    note: "単体のリールPRは内容に応じて個別にお見積もりします。",
  },
  {
    id: "instagram_stories",
    number: "04",
    category: "STORIES & MATERIALS",
    title: "ストーリーズ・撮影素材",
    description: "イベント告知、期間限定メニュー紹介、店舗用の素材制作にも対応。",
    includes: ["ご希望の掲載内容の確認", "撮影・編集", "納品物と用途の合意", "必要なPR表記"],
    note: "素材の二次利用・納品形式などは別途取り決めます。",
  },
] as const;

export default function DiaryServices() {
  const price = currentDiaryPricing();
  return (
    <div className="diary-v2">
      <DiaryHeader active="services" />
      <main id="diary-main" className="diary-services-page">
        <section className="diary-services-hero">
          <span className="diary-v2-eyebrow"><span className="diary-v2-spark" aria-hidden="true" /> SERVICES & PRICING</span>
          <h1>届けたいのは、<br />枚数じゃない。<br /><em>一投稿の価値。</em></h1>
          <p>グルメ日誌本人が、お店を訪問し、撮影から投稿まで対応。基本料金はInstagramの<strong>フィード投稿1件</strong>あたり。画像の枚数で値段が変わる仕組みではありません。</p>
          <p className="diary-price-teaser">写真フィード1投稿 <strong>{formatDiaryYen(price.amountYen)}</strong>（税込）<br />動画込みPR <strong>{formatDiaryYen(videoIncludedPriceForFollowers(price.followers))}〜</strong>（税込）</p>
          <div className="diary-v2-hero-actions">
            <a href="#pricing" className="diary-v2-button diary-v2-button-accent">料金を見る ↘</a>
            <a href="#work" className="diary-v2-text-link">Instagram投稿を見る ↘</a>
          </div>
        </section>

        <section className="diary-pricing-section diary-v2-pricing-section" id="pricing">
          <div className="diary-v2-container">
            <div className="diary-v2-section-head"><div><span className="diary-v2-section-label">01 / CLEAR PRICING</span><h2>わかりやすい、<br /><em>投稿単位の料金。</em></h2></div><p>一投稿に込める内容を大切に。画像枚数で区切るのではなく、何を伝えるかを相談して決めます。</p></div>
            <DiaryPricingPanel />
          </div>
        </section>

        <section className="diary-services-layout diary-v2-service-details" id="details">
          <div className="diary-v2-container">
            <div className="diary-v2-section-head"><div><span className="diary-v2-section-label">02 / WHAT WE INCLUDE</span><h2>依頼したいことに、<br /><em>合わせて選べる。</em></h2></div><p>写真投稿を軸に、動画やストーリーズなども選択できます。最終的な納品内容と料金は双方で合意して決定します。</p></div>
            <div className="diary-service-grid">
              {offerings.map((service) => (
                <article id={service.id} className="diary-service-detail" key={service.id}>
                  <div className="diary-service-detail-head">
                    <span>{service.number} / {service.category}</span>
                    <h3>{service.title}</h3>
                    <p>{service.description}</p>
                  </div>
                  <div className="diary-service-inclusions">
                    <strong>制作・対応内容</strong>
                    <ul>{service.includes.map((task) => <li key={task}>{task}</li>)}</ul>
                    <p>{service.note}</p>
                  </div>
                  <Link className="diary-service-request-link" href={`/diary/request?service=${service.id}&intent=application`}>このプランについて相談する ↗</Link>
                </article>
              ))}
            </div>
            <p className="diary-v2-service-disclaimer">※写真フィードの基本料金は投稿1件の制作・公開を対象とします。撮影条件、素材の二次利用、追加の投稿・媒体、交通費や食事提供条件等は事前に明示して合意します。</p>
          </div>
        </section>

        <section className="diary-v2-section diary-v2-instagram" id="work">
          <div className="diary-v2-container">
            <div className="diary-v2-section-head diary-v2-section-head-light"><div><span className="diary-v2-section-label">03 / LIVE ON INSTAGRAM</span><h2>制作の雰囲気は、<br /><em>公開済みの投稿から。</em></h2></div><p>制作途中のファイルや内部デザインは公開していません。実際にInstagramで公開された投稿をご覧いただけます。</p></div>
            <PostShowcase />
          </div>
        </section>

        <section className="diary-v2-section diary-v2-faq" id="questions">
          <div className="diary-v2-container diary-v2-faq-grid">
            <div><span className="diary-v2-section-label">04 / YOUR QUESTIONS</span><h2>依頼前に、<br /><em>確認したいこと。</em></h2></div>
            <div className="diary-v2-questions">
              <details><summary>フィード投稿の画像枚数で料金は変わりますか？<span aria-hidden="true">＋</span></summary><p>変わりません。料金単位は公開するInstagramフィード投稿1件です。使用する画像や紹介内容は事前にご相談いただきます。</p></details>
              <details><summary>動画制作も依頼できますか？<span aria-hidden="true">＋</span></summary><p>はい。写真フィード投稿に動画を加えるプランは15,000円（税込）からです。尺、制作物、投稿形態などは見積もり時に確認します。</p></details>
              <details><summary>申込み後すぐに料金が発生しますか？<span aria-hidden="true">＋</span></summary><p>フォームの送信だけでは契約は成立しません。提案された日時・制作内容・料金に双方が合意したあと確定します。お支払いは投稿公開後7日以内の後払いを基本としています。</p></details>
            </div>
          </div>
        </section>

        <section className="diary-v2-end"><div className="diary-v2-container diary-v2-end-inner"><span className="diary-v2-section-label">READY TO START?</span><h2>一投稿から、<br />新しい出会いを。</h2><p>ご相談とお見積もりは無料です。</p><div className="diary-v2-end-actions"><Link className="diary-v2-button diary-v2-button-accent" href="/diary/request?intent=consultation">無料で相談する ↗</Link><Link className="diary-v2-text-link" href="/diary">トップへ戻る ↗</Link></div></div></section>
      </main>
      <DiaryMobileCTA />
    </div>
  );
}
