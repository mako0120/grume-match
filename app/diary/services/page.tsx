import Link from "next/link";
import { PostShowcase } from "../components/post-showcase";
import { CanvaPortfolio } from "../components/canva-portfolio";
import { currentDiaryPricing, formatDiaryYen } from "@/lib/diary/pricing";

export const metadata = {
  title: "PRサービス・制作実例｜グルメ日誌｜大阪",
  description: "大阪のグルメ日誌本人に依頼できるInstagram投稿・撮影の内容、実際の投稿例、進行フローをご確認いただけます。",
};

const services = [
  {
    id: "instagram_feed",
    sectionId: "feed",
    no: "01",
    en: "EDITORIAL / FEED",
    name: "写真で伝えるフィード投稿",
    lead: "複数の写真と短い言葉で、料理の魅力とお店の空気感を伝えます。",
    tasks: ["店舗を訪問し撮影", "画像の選定・構成・編集", "紹介文・店舗情報の作成", "Instagram投稿・公開URL共有"],
    note: "掲載枚数、修正範囲、投稿時期はご相談時に決定します。",
  },
  {
    id: "instagram_reel",
    sectionId: "reel",
    no: "02",
    en: "SHORT FORM / REEL",
    name: "体験を伝えるリール動画",
    lead: "料理・調理・店内の様子を短い動画にまとめ、お店の雰囲気を届けます。",
    tasks: ["来店・動画撮影", "シーンの構成・編集", "必要に応じたテロップ・紹介文", "Instagramリール投稿・公開URL共有"],
    note: "動画時間・音声・ナレーション・追加撮影は個別に合意します。",
  },
  {
    id: "instagram_stories",
    sectionId: "stories",
    no: "03",
    en: "UPDATE / STORIES",
    name: "ストーリーズで紹介",
    lead: "新メニューやイベント、店舗へのアクセスなどを簡潔に紹介します。",
    tasks: ["紹介内容の確認", "写真・短い動画の編集", "Instagramストーリーズ投稿", "投稿実施のご報告"],
    note: "掲載期間や投稿回数、リンク設置の可否などは事前確認します。",
  },
  {
    id: "photo_video",
    sectionId: "material",
    no: "04",
    en: "VISUAL / CONTENT",
    name: "写真・動画素材の制作",
    lead: "店舗自身のSNSや案内用に使う撮影素材の制作も相談できます。",
    tasks: ["撮影対象と使用目的の確認", "店舗での撮影", "合意した素材の納品", "使用範囲・期間の取り決め"],
    note: "納品データの形式、点数、二次利用・広告転用の権利は個別見積もりです。",
  },
] as const;

export default function DiaryServices() {
  const price = currentDiaryPricing();
  return (
    <main className="diary-services-page">
      <header className="diary-service-nav">
        <Link href="/diary" className="diary-back">← グルメ日誌｜大阪へ戻る</Link>
        <Link href="/diary/request" className="diary-service-nav-button">PRを相談する ↗</Link>
      </header>

      <section className="diary-services-hero">
        <span className="diary-overline"><span className="diary-dot" /> OUR CREATIVE SERVICE</span>
        <h1>どんな投稿を<br />お願いできるのか。<br /><em>依頼前に、全部わかる。</em></h1>
        <p>グルメ日誌本人が、お店を訪問して撮影・編集・発信。投稿の雰囲気や制作の範囲をあらかじめご確認いただいたうえで、ご希望に合う形をご提案します。</p>
        <p className="diary-price-teaser">現在のInstagramフィードPR：<strong>{formatDiaryYen(price.amountYen)}</strong>／1投稿（税込総額）<br />直接依頼料金はフォロワー増加に応じて今後改定予定です。</p>
        <a href="#work" className="diary-button diary-button-primary">実際の投稿を見る ↘</a>
      </section>

      <section className="diary-services-layout" id="contents">
        <div className="diary-section-top"><span>WHAT IS INCLUDED</span><span>ご依頼の内容</span></div>
        <h2>届け方は、お店に合わせて。</h2>
        <div className="diary-service-grid">
          {services.map((service) => (
            <article id={service.sectionId} className="diary-service-detail" key={service.id}>
              <div className="diary-service-detail-head">
                <span>{service.no} / {service.en}</span>
                <h3>{service.name}</h3>
                <p>{service.lead}</p>
              </div>
              <div className="diary-service-inclusions">
                <strong>ご相談できる制作内容</strong>
                <ul>{service.tasks.map((task) => <li key={task}>{task}</li>)}</ul>
                <p>{service.note}</p>
              </div>
              <Link className="diary-service-request-link" href={`/diary/request?service=${service.id}`}>
                この内容で相談する ↗
              </Link>
            </article>
          ))}
        </div>
        <section className="diary-editorial-example">
          <div className="diary-editorial-top">
            <span className="diary-overline">A TYPICAL FEED STORY</span>
            <h3>フィード投稿は、<br />こんな流れで紹介します。</h3>
            <p>お店の魅力を伝えるための構成例です。投稿の枚数や順序は、店舗・撮影内容に合わせて決定します。</p>
          </div>
          <div className="diary-editorial-steps">
            <div><span>01 / COVER</span><strong>目を引く表紙</strong><p>お店や料理の魅力が一目で伝わる写真とコピー。</p></div>
            <div><span>02 / PLACE</span><strong>店舗・アクセス</strong><p>店名やエリア、アクセスを分かりやすく紹介。</p></div>
            <div><span>03 / FOOD</span><strong>料理の魅力</strong><p>写真を中心に、実際にいただいた料理の特徴を紹介。</p></div>
            <div><span>04 / MOOD</span><strong>店内・雰囲気</strong><p>席や空間、過ごし方が伝わる写真と言葉。</p></div>
            <div><span>05 / SAVE</span><strong>まとめ・保存導線</strong><p>「行ってみたい」と思ったときに振り返れる情報。</p></div>
          </div>
          <p className="diary-editorial-caption">投稿本文（キャプション）も制作対象です。所在地・営業時間等は最新情報を確認し、広告関係は明確に表示します。完成済みの3投稿は下の「実際の投稿を見る」から確認できます。</p>
          <a href="#work" className="diary-editorial-cta">実際の3投稿を見る ↓</a>
        </section>
        <div className="diary-price-note">
          <strong>料金は個別にご案内します。</strong>
          <p>撮影場所・制作内容・媒体・投稿回数・二次利用の有無などにより異なります。お問い合わせ・お見積もりは無料です。費用・制作範囲・納期は必ずご依頼前に確認し、双方合意のうえ進めます。</p>
        </div>
      </section>

      <section className="diary-canva-samples" id="carousel-portfolio">
        <div className="diary-section-top"><span>CANVA WORKS</span><span>10–20 PAGE CAROUSEL</span></div>
        <div className="diary-work-intro">
          <h2>10枚・16枚・20枚。<br /><em>実際の作品と、料金目安。</em></h2>
          <p>北浜 焼とりporc・銀蔵 小野原本店・煮炊き焼き鳥 御尽の制作物を確認できます。</p>
        </div>
        <CanvaPortfolio pricing />
      </section>

      <section className="diary-work" id="work">
        <div className="diary-section-top"><span>SELECTED POSTS</span><span>@gurunavi_diary</span></div>
        <div className="diary-work-intro">
          <h2>言葉で説明するより、<br /><em>まず投稿を。</em></h2>
          <p>グルメ日誌がどんな雰囲気でお店を紹介しているか、実際のInstagram投稿でお確かめください。</p>
        </div>
        <PostShowcase />
      </section>

      <section className="diary-scope">
        <div className="diary-section-top"><span>BEFORE BOOKING</span><span>安心してご依頼いただくために</span></div>
        <h2>ご相談の前に、<em>お約束します。</em></h2>
        <div className="diary-scope-grid">
          <article><b>01</b><h3>担当はグルメ日誌本人</h3><p>第三者のインフルエンサーを紹介するサービスではありません。お店への訪問から制作・発信まで、グルメ日誌への直接依頼です。</p></article>
          <article><b>02</b><h3>発信内容は実体験から</h3><p>実際に見て、食べて、感じたことを大切にします。高評価や肯定的な感想を保証する案件はお受けしません。</p></article>
          <article><b>03</b><h3>PR表記とルールを守る</h3><p>広告・提供関係は明瞭に表示します。食べログやGoogleマップ等への対価付き口コミをセットで求める案件は受け付けません。</p></article>
          <article><b>04</b><h3>成果は保証ではなく検証</h3><p>フォロワー増加や来店・売上を保証するものではありません。投稿の公開URLをご案内し、レポートの範囲は事前にご相談します。</p></article>
        </div>
        <p><Link href="/diary/policy">案件受注ポリシーを読む ↗</Link></p>
      </section>

      <section className="diary-final-cta">
        <span>LET US TELL YOUR STORY.</span>
        <h2>お店だけの「おいしい」を、<br /><em>まだ知らない誰かへ。</em></h2>
        <p>まずはお店のことを聞かせてください。お見積もり・ご相談は無料です。</p>
        <Link href="/diary/request" className="diary-button diary-button-light">グルメ日誌へPRを相談する <span>↗</span></Link>
      </section>
    </main>
  );
}
