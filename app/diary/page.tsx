import Link from "next/link";
import { PostShowcase } from "./components/post-showcase";
import { DiaryHeader, DiaryMobileCTA } from "./components/site-header";
import { currentDiaryPricing, formatDiaryYen, videoIncludedPriceForFollowers } from "@/lib/diary/pricing";

const metrics = [
  { value: "17.6万", unit: "回", label: "コンテンツ再生数" },
  { value: "76,876", unit: "人", label: "閲覧者数" },
  { value: "+1,335", unit: "人", label: "フォロワー純増" },
];

const process = [
  { number: "01", title: "相談・ご依頼", description: "お店の特徴や伝えたい魅力をフォームから送信。ご相談だけでも歓迎です。" },
  { number: "02", title: "内容と日程の合意", description: "紹介内容、投稿件数、料金、訪問日時を提案し、双方の確認後に確定します。" },
  { number: "03", title: "訪問・制作", description: "店舗での撮影から編集、キャプション制作まで本人が対応します。" },
  { number: "04", title: "Instagram公開・お支払い", description: "PR表記を付けて投稿。公開後7日以内の後払いでご案内します。" },
];

export default function DiaryHomePage() {
  const price = currentDiaryPricing();
  const videoPrice = videoIncludedPriceForFollowers(price.followers);
  return (
    <div className="diary-v2">
      <DiaryHeader active="home" />
      <main id="diary-main">
        <section className="diary-v2-hero" aria-labelledby="diary-v2-hero-heading">
          <div className="diary-v2-hero-inner">
            <div className="diary-v2-hero-copy">
              <span className="diary-v2-eyebrow"><span aria-hidden="true" className="diary-v2-spark" /> OSAKA × GOURMET × STORYTELLING</span>
              <p className="diary-v2-hero-kicker">おいしい、を届ける仕事。</p>
              <h1 id="diary-v2-hero-heading">まだ知らない<br /><span>「おいしい」</span>を、<br />次の出会いへ。</h1>
              <p className="diary-v2-hero-lead">料理の魅力も、お店の空気も。一皿に込められた想いを、写真と言葉に。大阪のグルメ日誌が、訪れてみたくなるInstagram投稿を制作します。</p>
              <div className="diary-v2-hero-actions">
                <Link className="diary-v2-button diary-v2-button-accent" href="/diary/request?intent=consultation">無料でPR相談する <span aria-hidden="true">↗</span></Link>
                <a className="diary-v2-text-link" href="https://www.instagram.com/gurunavi_diary/" target="_blank" rel="noopener noreferrer">Instagramを見る <span aria-hidden="true">↗</span></a>
              </div>
              <div className="diary-v2-hero-promise"><span aria-hidden="true">✳</span> グルメ日誌本人が直接対応 <span aria-hidden="true">·</span> 相談・見積もり無料</div>
            </div>
            <div className="diary-v2-poster" aria-label="グルメ日誌 大阪のブランドビジュアル">
              <span className="diary-v2-poster-top">A GOOD MEAL, A GOOD STORY. <span>001 / OSAKA</span></span>
              <div className="diary-v2-poster-disc" aria-hidden="true" />
              <div className="diary-v2-poster-text" aria-hidden="true"><span>出会って、</span><strong>おいしい。</strong></div>
              <div className="diary-v2-poster-bottom"><span>GOURMET<br />DIARY</span><span>NOT JUST A PHOTO.<br />A REASON TO VISIT.</span></div>
            </div>
            <div className="diary-v2-hero-edge" aria-hidden="true">SCROLL TO EXPLORE ↓</div>
          </div>
        </section>

        <section className="diary-v2-price-ribbon" aria-label="PR基本料金">
          <div className="diary-v2-container diary-v2-price-ribbon-inner">
            <div className="diary-v2-ribbon-tag"><span className="diary-v2-ribbon-dot" /> SIMPLE PRICING</div>
            <div className="diary-v2-ribbon-price"><small>Instagram写真フィード</small><strong>1投稿 <em>{formatDiaryYen(price.amountYen)}</em></strong><span>税込・基本料金</span></div>
            <div className="diary-v2-ribbon-desc">投稿内の画像枚数で料金は変わりません。<br />動画込みは{formatDiaryYen(videoPrice)}〜。</div>
            <Link href="/diary/services#pricing" className="diary-v2-ribbon-link">プラン詳細 <span aria-hidden="true">↗</span></Link>
          </div>
        </section>

        <section className="diary-v2-section diary-v2-proof" id="results" aria-labelledby="diary-v2-results-title">
          <div className="diary-v2-container">
            <div className="diary-v2-section-head">
              <div><span className="diary-v2-section-label">01 / TRACK RECORD</span><h2 id="diary-v2-results-title">投稿の先に、<br /><em>出会いがある。</em></h2></div>
              <p>見られた回数だけでなく、まだ知らないお店に興味を持ってもらうこと。その第一歩を大切にしています。</p>
            </div>
            <div className="diary-v2-metrics">
              {metrics.map((m) => <article className="diary-v2-metric" key={m.label}><span className="diary-v2-metric-label">{m.label}</span><div><strong>{m.value}</strong><span>{m.unit}</span></div><span className="diary-v2-metric-decoration" aria-hidden="true">↗</span></article>)}
            </div>
            <p className="diary-v2-data-note">※ Instagramインサイト（2026年9月16日〜10月15日の30日間）。数値は過去の実績であり、PRの再生数・集客・売上を保証するものではありません。</p>
          </div>
        </section>

        <section className="diary-v2-section diary-v2-instagram" id="work" aria-labelledby="diary-v2-posts-title">
          <div className="diary-v2-container">
            <div className="diary-v2-section-head diary-v2-section-head-light">
              <div><span className="diary-v2-section-label">02 / ON INSTAGRAM</span><h2 id="diary-v2-posts-title">作品は、<br /><em>Instagramで。</em></h2></div>
              <div className="diary-v2-section-aside"><p>公開済みの実際の投稿から、写真・構成・言葉づかいをご覧いただけます。編集データや未公開素材は掲載していません。</p><a href="https://www.instagram.com/gurunavi_diary/" target="_blank" rel="noopener noreferrer" className="diary-v2-inline-arrow">@gurunavi_diary を見る ↗</a></div>
            </div>
            <PostShowcase />
          </div>
        </section>

        <section className="diary-v2-section diary-v2-packages" id="services" aria-labelledby="diary-v2-services-title">
          <div className="diary-v2-container">
            <div className="diary-v2-section-head">
              <div><span className="diary-v2-section-label">03 / OUR SERVICES</span><h2 id="diary-v2-services-title">伝えたい魅力に、<br /><em>ちょうどいい形を。</em></h2></div>
              <p>投稿そのものを、一つの作品として。基本料金は投稿件数を基準に、制作内容はお店ごとに相談して決めます。</p>
            </div>
            <div className="diary-v2-plans">
              <article className="diary-v2-plan diary-v2-plan-featured">
                <div className="diary-v2-plan-top"><span>01 / PHOTO FEED</span><span className="diary-v2-plan-pill">基本プラン</span></div>
                <h3>写真フィード投稿</h3>
                <p>料理やお店の魅力を、写真とキャプションで紹介。</p>
                <div className="diary-v2-plan-price"><strong>{formatDiaryYen(price.amountYen)}</strong><span>/ Instagram投稿1件・税込</span></div>
                <p className="diary-v2-plan-rule">画像枚数による追加料金なし。投稿に使用する写真や内容は事前相談で決定。</p>
                <Link className="diary-v2-plan-cta" href="/diary/request?service=instagram_feed&intent=application">このプランを申し込む <span aria-hidden="true">↗</span></Link>
              </article>
              <article className="diary-v2-plan">
                <div className="diary-v2-plan-top"><span>02 / PHOTO + MOTION</span><span className="diary-v2-plan-pill diary-v2-plan-pill-outline">動画込み</span></div>
                <h3>写真＋ショート動画</h3>
                <p>フィード投稿に動画制作を組み合わせ、動きも届けるプラン。</p>
                <div className="diary-v2-plan-price"><strong>{formatDiaryYen(videoPrice)}<small>〜</small></strong><span>/ 税込・制作一式の開始価格</span></div>
                <p className="diary-v2-plan-rule">動画の長さ・投稿方法・納品物は契約前に合意。その他のご相談も可能です。</p>
                <Link className="diary-v2-plan-cta" href="/diary/request?service=instagram_feed_video&intent=application">動画込みで相談する <span aria-hidden="true">↗</span></Link>
              </article>
            </div>
            <div className="diary-v2-package-foot"><span>ストーリーズ・撮影素材・リール単体も個別見積もりで対応</span><Link href="/diary/services">すべてのサービスを見る ↗</Link></div>
          </div>
        </section>

        <section className="diary-v2-section diary-v2-story" id="philosophy">
          <div className="diary-v2-container diary-v2-story-grid">
            <div className="diary-v2-story-visual" aria-hidden="true"><span>食べることが、<br />好きだから。</span><b>食</b><small>MADE WITH CURIOSITY / OSAKA</small></div>
            <div className="diary-v2-story-copy"><span className="diary-v2-section-label">04 / OUR PHILOSOPHY</span><h2>一皿の魅力を、<br /><em>きちんと伝える。</em></h2><p>「こんなお店があったんだ」。そんな小さな発見が、誰かの次の食事のきっかけになる。グルメ日誌は、実際に見て、食べて、感じたことを大切に制作しています。</p><p>表現の自由とお店への敬意を両立し、広告・提供関係は明確にお伝えします。</p><Link href="/diary/policy" className="diary-v2-inline-arrow">PR制作のポリシー ↗</Link></div>
          </div>
        </section>

        <section className="diary-v2-section diary-v2-process" id="flow">
          <div className="diary-v2-container">
            <div className="diary-v2-section-head"><div><span className="diary-v2-section-label">05 / HOW IT WORKS</span><h2>相談から投稿まで、<br /><em>シンプルに。</em></h2></div><p>お問い合わせのみでは契約になりません。内容・費用・日程に双方が合意してから進みます。</p></div>
            <ol className="diary-v2-process-grid">{process.map((step) => <li key={step.number}><span>{step.number}</span><h3>{step.title}</h3><p>{step.description}</p></li>)}</ol>
          </div>
        </section>

        <section className="diary-v2-section diary-v2-faq" id="faq">
          <div className="diary-v2-container diary-v2-faq-grid">
            <div><span className="diary-v2-section-label">06 / FAQ</span><h2>よくある<br /><em>ご質問。</em></h2><p>事前に確認しておきたい点をまとめました。</p></div>
            <div className="diary-v2-questions">
              <details><summary>写真の枚数によって料金は変わりますか？<span aria-hidden="true">＋</span></summary><p>いいえ。基本料金はInstagramのフィード投稿1件あたりです。写真の枚数に応じた料金表ではありません。制作内容は事前に相談して決定します。</p></details>
              <details><summary>相談したら必ず依頼する必要がありますか？<span aria-hidden="true">＋</span></summary><p>ありません。ご相談・お見積もりは無料です。制作内容・料金・訪問日時を確認し、ご納得いただいてから正式なご依頼になります。</p></details>
              <details><summary>お支払いはいつですか？<span aria-hidden="true">＋</span></summary><p>Instagramへの投稿公開後、7日以内に全額お支払いいただく後払い方式を予定しています。契約時に支払い条件を確認します。</p></details>
              <details><summary>PR表記は入りますか？<span aria-hidden="true">＋</span></summary><p>はい。広告・提供関係が分かる適切な表記を行います。高評価の保証や口コミサイトへの対価付き投稿などはお受けしていません。</p></details>
            </div>
          </div>
        </section>

        <section className="diary-v2-end" aria-labelledby="diary-v2-cta-title">
          <div className="diary-v2-container diary-v2-end-inner">
            <span className="diary-v2-section-label">LET US TELL YOUR STORY</span>
            <h2 id="diary-v2-cta-title">その「おいしい」を、<br />一緒に届けませんか。</h2>
            <p>まずは、お店のことを聞かせてください。</p>
            <div className="diary-v2-end-actions"><Link href="/diary/request?intent=consultation" className="diary-v2-button diary-v2-button-accent">無料で相談する ↗</Link><Link href="/diary/services" className="diary-v2-text-link">料金・サービスを確認する ↗</Link></div>
          </div>
        </section>
      </main>
      <footer className="diary-v2-footer"><div className="diary-v2-container"><div><Link href="/diary" className="diary-v2-footer-logo">グルメ日誌 <small>OSAKA</small></Link><p>まだ知らない「おいしい」に、出会うきっかけを。</p></div><nav aria-label="フッター"><a href="https://www.instagram.com/gurunavi_diary/" target="_blank" rel="noopener noreferrer">INSTAGRAM ↗</a><Link href="/diary/services">サービスと料金</Link><Link href="/legal/privacy">プライバシー</Link><Link href="/legal/operator">運営者情報</Link><Link href="/diary/policy">受注ポリシー</Link></nav><span>© 2026 GOURMET DIARY OSAKA</span></div></footer>
      <DiaryMobileCTA />
    </div>
  );
}
