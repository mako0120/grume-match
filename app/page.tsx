import Link from "next/link";
import { PLATFORM_FEE_MINIMUM, PLATFORM_FEE_RATE, platformFee } from "@/lib/pricing";

// What makes this product different from the usual free-invitation /
// flat-rate services. See docs/COMPETITIVE_ANALYSIS.md for the research.
const differences = [
  {
    topic: "Creatorへの対価",
    usual: "食事の無償提供が中心",
    ours: "現金報酬が必須。0円の案件は公開できません",
  },
  {
    topic: "日程調整",
    usual: "DMで候補を往復",
    ours: "空き時間をタップして確定。二重予約は自動で防止",
  },
  {
    topic: "Creatorの選び方",
    usual: "フォロワー数・条件の絞り込み",
    ours: "直近30日の閲覧・大阪での投稿実績・PR完了数で相性を点数化。理由も表示",
  },
  {
    topic: "実績の信頼性",
    usual: "自己申告のフォロワー数",
    ours: "インサイトの画面を運営が確認し「運営確認済み」を表示",
  },
  {
    topic: "効果測定",
    usual: "いいね・再生数まで",
    ours: "PRリンクの閲覧数と、PRコードで記録した来店から来店1件あたりの費用まで",
  },
  {
    topic: "どれだけ見られたか",
    usual: "Creatorの自己申告・スクショを各自で確認",
    ours: "投稿ごとの閲覧数・閲覧した人・保存を運営が確認し、1,000閲覧あたりの費用まで表示",
  },
  {
    topic: "評価",
    usual: "評価なし、または先に書いた側が不利",
    ours: "PR後にお互いを評価。双方が送るまで非公開で、次のマッチングに反映",
  },
  {
    topic: "写真・動画の二次利用",
    usual: "個別に交渉・契約",
    ours: "範囲・期間（30/90/365日）・料金を案件に明記。期限後は自動で利用停止",
  },
] as const;

export default function HomePage() {
  return (
    <main className="site-shell">
      <section className="hero-panel">
        <span className="eyebrow">GOURMET DIARY</span>
        <h1>有償PRを、合う人に。DMなしで、来店まで。</h1>
        <p>
          飲食店とグルメCreatorを、現金報酬が明示されたPR案件でつなぎます。
          相性の良いCreatorを理由つきで提案し、日程はタップで確定。投稿の確認から報酬の管理、来店の計測まで1つのアプリで進みます。
        </p>

        <div className="hero-actions">
          <Link className="primary-button" href="/signup">
            無料で始める
          </Link>
          <Link className="secondary-button" href="/login">
            ログイン
          </Link>
          <span className="status-pill">大阪で提供中</span>
        </div>
      </section>

      <section className="feature-grid" aria-label="主要機能">
        <article className="feature-card">
          <strong>現金報酬つきの有償PR</strong>
          <p>食事提供とは別に、Creatorへの報酬を必ず明示。PR表記が前提の、ステマ規制に沿った運用です。</p>
        </article>

        <article className="feature-card">
          <strong>理由がわかるマッチング</strong>
          <p>「大阪で投稿実績あり（6本）」「1投稿あたり中央値1.2万閲覧」など、選ぶ理由をそのまま表示します。</p>
        </article>

        <article className="feature-card">
          <strong>来店まで計測</strong>
          <p>Creatorごとのリンクと口頭で伝えられるPRコードで、何人に見られ、何組が来店したか、来店1件あたりの費用が分かります。</p>
        </article>
      </section>

      <section className="compare-section" aria-labelledby="compare-heading">
        <span className="eyebrow">WHY GOURMET DIARY</span>
        <h2 id="compare-heading">よくある無償招待・定額型との違い</h2>

        <div className="compare-list">
          {differences.map((row) => (
            <article className="compare-row" key={row.topic}>
              <strong>{row.topic}</strong>
              <div className="compare-usual">
                <span>よくある形</span>
                <p>{row.usual}</p>
              </div>
              <div className="compare-ours">
                <span>GOURMET DIARY</span>
                <p>{row.ours}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="compare-section" aria-labelledby="pricing-heading">
        <span className="eyebrow">PRICING</span>
        <h2 id="pricing-heading">料金</h2>
        <div className="feature-grid pricing-grid">
          <article className="feature-card">
            <strong>初期費用・月額 0円</strong>
            <p>使わない月は費用がかかりません。依頼し放題の月額契約はありません。</p>
          </article>
          <article className="feature-card">
            <strong>手数料はPRが完了した時だけ</strong>
            <p>
              投稿を承認した時に、Creator報酬の{PLATFORM_FEE_RATE * 100}%（最低¥{PLATFORM_FEE_MINIMUM.toLocaleString("ja-JP")}）。
              報酬¥8,000なら手数料¥{platformFee(8000).toLocaleString("ja-JP")}。Creatorには報酬を全額お支払いします。
            </p>
          </article>
          <article className="feature-card">
            <strong>最初の1件は手数料無料</strong>
            <p>まずは1件、相性の良いCreatorで試してください。来店単価・1,000閲覧あたりの費用まで確認できます。</p>
          </article>
        </div>
      </section>

      <section className="audience-grid" aria-label="利用者別">
        <article className="feature-card">
          <strong>飲食店の方へ</strong>
          <p>
            「来たけど来店が増えなかった」「投稿されなかった」「DM対応がつらい」をなくすための設計です。報酬・日程・投稿確認・効果まで、店舗側の操作はタップ中心です。
          </p>
        </article>
        <article className="feature-card">
          <strong>Creatorの方へ</strong>
          <p>
            食事だけではなく現金報酬が出る案件だけ。実績のスクショを送るだけで、あなたのエリアと実績に合う案件の招待が届きます。
          </p>
        </article>
      </section>
    </main>
  );
}
