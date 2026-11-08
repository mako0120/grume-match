import type { Metadata } from "next";
import Link from "next/link";
import { buildDiaryConsultationEmail } from "@/lib/diary/email-draft";
import { PostShowcase } from "../components/post-showcase";
import { DiaryHeader, DiaryMobileCTA } from "../components/site-header";
import {
  currentDiaryPricing,
  formatDiaryYen,
  videoIncludedPriceForFollowers,
} from "@/lib/diary/pricing";
import "./pr.css";

export const metadata: Metadata = {
  title: "飲食店PRのご依頼｜1案件から依頼できるグルメ日誌｜大阪",
  description: "大阪の飲食店向けInstagram PR。月額契約不要・1案件ごとに依頼できます。写真フィード・動画込みPRの料金と制作内容を確認し、無料でご相談いただけます。",
  alternates: { canonical: "/diary/pr" },
  openGraph: {
    title: "大阪の飲食店PR｜グルメ日誌",
    description: "1案件から。訪問・撮影・編集・Instagram投稿まで。お店の魅力を丁寧にお届けします。",
    url: "/diary/pr",
    type: "website",
    locale: "ja_JP",
  },
};

const steps = [
  ["01", "無料でご相談", "店舗名・紹介したい料理・ご希望日をお知らせください。"],
  ["02", "お見積もり・日程確定", "投稿内容と税込料金、交通費などを事前にご案内します。"],
  ["03", "来店・撮影・編集", "グルメ日誌本人が訪問し、実際に体験した内容を制作します。"],
  ["04", "Instagram投稿・お支払い", "広告・PR表示を付けて公開。原則、投稿後7日以内に後払い。"],
] as const;

export default function DiaryOneOffPrPage() {
  const pricing = currentDiaryPricing();
  const photo = formatDiaryYen(pricing.amountYen);
  const video = formatDiaryYen(videoIncludedPriceForFollowers(pricing.followers));
  const emailContact = buildDiaryConsultationEmail();
  return (
    <div className="diary-v2 diary-pr-page">
      <DiaryHeader active="services" />
      <main id="diary-main">
        <section className="diary-pr-hero">
          <div className="diary-v2-container diary-pr-hero-grid">
            <div className="diary-pr-hero-copy">
              <span className="diary-v2-section-label">OSAKA / RESTAURANT INSTAGRAM PR</span>
              <h1>お店の魅力を、<br /><em>次のお客様へ。</em></h1>
              <p className="diary-pr-hero-lead">グルメ日誌｜大阪のInstagramで、お店や料理をPRしませんか？ ご依頼は<strong>1案件・1投稿から</strong>。グルメ日誌本人が、来店・撮影・編集・投稿まで対応します。</p>
              <div className="diary-pr-hero-actions">
                <Link href="/diary/request?service=instagram_feed&intent=application" className="diary-v2-button diary-v2-button-accent">PRを依頼・相談する ↗</Link>
                <a className="diary-v2-text-link" href={emailContact.gmailUrl} target="_blank" rel="noopener noreferrer">Gmailで直接相談する ↗</a>
              </div>
              <p className="diary-pr-hero-note">相談・見積もり無料 ／ 自動契約・自動課金なし ／ 料金は事前に合意</p>
            </div>
            <div className="diary-pr-hero-poster" aria-label="PRプランの開始価格">
              <span>GOURMET DIARY OSAKA</span>
              <strong>一投稿に、<br />お店らしさを。</strong>
              <div><small>PHOTO FEED / 1 POST</small><b>{photo}</b><small>税込・基本料金</small></div>
            </div>
          </div>
        </section>

        <section className="diary-pr-section" aria-labelledby="diary-pr-plans">
          <div className="diary-v2-container">
            <div className="diary-pr-section-heading">
              <span className="diary-v2-section-label">SIMPLE PR PLANS</span>
              <h2 id="diary-pr-plans">1案件ごとの、<br /><em>わかりやすいPR料金。</em></h2>
              <p>必要なPRを、必要なタイミングで。料金はInstagram投稿1件・制作内容単位です。写真の枚数だけで追加料金はいただきません。</p>
            </div>
            <div className="diary-pr-plan-grid">
              <article className="diary-pr-plan-card diary-pr-plan-featured">
                <span className="diary-pr-plan-tag">01 / PHOTO FEED</span>
                <h3>Instagram写真フィードPR</h3>
                <div className="diary-pr-plan-price"><strong>{photo}</strong><span>税込 / 1投稿</span></div>
                <p>お店へ訪問し、料理の魅力やお店の雰囲気を写真と文章で丁寧に紹介します。</p>
                <ul>
                  <li>店舗訪問・撮影</li>
                  <li>写真の選定・明るさ等の編集</li>
                  <li>投稿用キャプション・PR表記</li>
                  <li>Instagramフィード1投稿</li>
                </ul>
                <Link href="/diary/request?service=instagram_feed&intent=application">写真PRを相談する ↗</Link>
              </article>
              <article className="diary-pr-plan-card">
                <span className="diary-pr-plan-tag">02 / PHOTO + VIDEO</span>
                <h3>写真＋ショート動画PR</h3>
                <div className="diary-pr-plan-price"><strong>{video}〜</strong><span>税込 / 1案件</span></div>
                <p>写真に加えてショート動画も制作。料理の臨場感や空間の魅力を表現します。</p>
                <ul>
                  <li>店舗訪問・写真・動画撮影</li>
                  <li>写真フィード1投稿の制作</li>
                  <li>ショート動画の構成・編集</li>
                  <li>動画の尺・掲載先・納品形態は事前相談</li>
                </ul>
                <Link href="/diary/request?service=instagram_feed_video&intent=application">動画込みPRを相談する ↗</Link>
              </article>
            </div>
            <p className="diary-pr-plan-fineprint">リール単体・ストーリーズ・追加投稿・撮影素材の二次利用も個別にお見積もりできます。交通費・食事提供条件・追加制作費は契約前に明示します。掲載後の再生数・来店・売上は保証するものではありません。</p>
          </div>
        </section>

        <section className="diary-pr-section diary-pr-how" aria-labelledby="diary-pr-flow">
          <div className="diary-v2-container">
            <div className="diary-pr-section-heading">
              <span className="diary-v2-section-label">HOW IT WORKS</span>
              <h2 id="diary-pr-flow">ご依頼から投稿まで、<br /><em>4つのステップ。</em></h2>
            </div>
            <div className="diary-pr-steps">
              {steps.map(([number, title, description]) => (
                <div className="diary-pr-step" key={number}>
                  <span>{number}</span><h3>{title}</h3><p>{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="diary-pr-section diary-pr-work" aria-labelledby="diary-pr-posts">
          <div className="diary-v2-container">
            <div className="diary-pr-section-heading">
              <span className="diary-v2-section-label">INSTAGRAM PORTFOLIO</span>
              <h2 id="diary-pr-posts">実際の投稿を、<br /><em>ご覧ください。</em></h2>
              <p>Instagramの公開済み投稿を紹介しています。各投稿が有料PRであることや特定の成果を示すものではありません。</p>
            </div>
            <PostShowcase />
          </div>
        </section>

        <section className="diary-pr-section diary-pr-faq" aria-labelledby="diary-pr-faq-title">
          <div className="diary-v2-container">
            <div className="diary-pr-section-heading">
              <span className="diary-v2-section-label">FAQ</span>
              <h2 id="diary-pr-faq-title">よくあるご質問</h2>
            </div>
            <div className="diary-pr-faq-items">
              <details><summary>毎月の契約が必要ですか？</summary><p>いいえ。1案件ごとのご依頼です。月額契約・自動更新・自動課金はありません。</p></details>
              <details><summary>相談した時点で料金が発生しますか？</summary><p>いいえ。無料でご相談いただけます。制作内容・日程・料金に双方が合意した後にご依頼が確定します。</p></details>
              <details><summary>写真の枚数で料金が変わりますか？</summary><p>Instagramフィード1投稿の基本料金です。掲載する写真の枚数だけでは追加料金は発生しません。</p></details>
              <details><summary>口コミサイトへの投稿も依頼できますか？</summary><p>報酬・提供と引き換えのGoogleマップ・食べログ等の口コミ投稿や高評価の指定はお受けしていません。Instagramでは広告関係が分かるようPR表示を行います。</p></details>
            </div>
          </div>
        </section>

        <section className="diary-pr-final">
          <div className="diary-v2-container">
            <span className="diary-v2-section-label">LET&apos;S WORK TOGETHER</span>
            <h2>お店のPR、<br />まずは1件から。</h2>
            <p>ご相談・お見積もりは無料です。フォームとGmailの両方から、1案件ごとのPRをご相談いただけます。</p>
            <div className="diary-pr-final-buttons">
              <Link className="diary-v2-button diary-v2-button-accent" href="/diary/request?intent=consultation">無料でPR相談する ↗</Link>
              <a href={emailContact.gmailUrl} target="_blank" rel="noopener noreferrer">Gmailで直接相談する ↗</a>
            </div>
            <p className="diary-pr-legal"><a href="https://www.instagram.com/gurunavi_diary/" target="_blank" rel="noopener noreferrer">Instagramの実際の投稿を見る ↗</a><Link href="/diary/policy">PR・撮影方針</Link><Link href="/legal/privacy">プライバシーポリシー</Link><Link href="/legal/operator">運営者情報</Link></p>
          </div>
        </section>
      </main>
      <DiaryMobileCTA />
    </div>
  );
}
