import Link from "next/link";
import { CURRENT_POLICY_VERSION } from "@/lib/policies";

export default function PrGuidelinesPage() {
  return (
    <main className="legal-shell">
      <article className="legal-document">
        <Link className="back-link" href="/legal/accept">← 確認画面へ</Link>
        <span className="eyebrow">PR GUIDELINES</span>
        <h1>PRガイドライン</h1>
        <p className="legal-version">Version: {CURRENT_POLICY_VERSION}</p>

        <h2>広告・PRであることを明確にする</h2>
        <p>
          現金報酬や食事提供を受ける投稿では、投稿を見た人が広告関係を理解できるよう、
          「PR」「広告」等の分かりやすい表示を行ってください。
        </p>

        <h2>実際の体験に基づいて投稿する</h2>
        <p>
          食べていない料理の感想、利用していないサービスの体験談、
          確認していない事実を実体験のように表現しないでください。
        </p>

        <h2>評価内容を強制しない</h2>
        <p>
          店舗は高評価や肯定的な感想を条件にしてはいけません。
          Creatorは案件条件を守りつつ、自身の表現で正確に紹介できます。
        </p>

        <h2>Google口コミをPR成果物にしない</h2>
        <p>
          Google Mapsの口コミ・評価は、現金報酬、割引、無料の商品やサービス等と
          引き換えに投稿させることが禁止されています。
          GOURMET DIARYの有償PRではGoogle口コミを必須成果物に設定しません。
          その他の口コミサービスについても各サービスの最新ルールを優先してください。
        </p>

        <h2>誤認を招く表現を避ける</h2>
        <p>
          価格、営業時間、限定条件、受賞歴、効果効能等は確認できる情報に基づき、
          根拠のない「絶対」「No.1」等の断定表現を避けてください。
        </p>

        <h2>権利を尊重する</h2>
        <p>
          他人の写真、動画、音源、文章、商標等を無断利用しないでください。
          二次利用が必要な場合は、案件条件で利用範囲を別途合意してください。
        </p>

        <h2>問題が起きた場合</h2>
        <p>
          投稿条件や事実関係に相違がある場合は、証拠を残したうえで運営へ共有してください。
          アプリ外での一方的な条件変更や圧力による解決は避けてください。
        </p>
      </article>
    </main>
  );
}
