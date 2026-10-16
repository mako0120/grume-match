import Link from "next/link";
import { CURRENT_POLICY_VERSION } from "@/lib/policies";

export default function PrivacyPage() {
  return (
    <main className="legal-shell">
      <article className="legal-document">
        <Link className="back-link" href="/legal/accept">← 確認画面へ</Link>
        <span className="eyebrow">PRIVACY</span>
        <h1>プライバシーポリシー</h1>
        <p className="legal-version">Version: {CURRENT_POLICY_VERSION}</p>

        <h2>取得する情報</h2>
        <p>
          メールアドレス、アカウント種別、Creatorプロフィール、SNS実績、
          店舗情報、案件・応募・来店・投稿・支払い状態、通知および監査ログ等を取り扱います。
                  グルメ日誌への直接PR相談では、店舗名・担当者名・メールアドレス・電話番号（任意）・SNS URL（任意）・相談内容・予算目安・希望時期・同意日時を取得します。
        </p>

        <h2>利用目的</h2>
        <p>
          本人確認、案件マッチング、日程調整、投稿確認、報酬管理、不正防止、
          サポート、サービス改善、重要なお知らせのために利用します。
        </p>

        <h2>相手方への表示</h2>
        <p>
          案件の成立に必要な範囲で、Creatorの表示名・公開SNS実績や店舗情報等を
          取引相手に表示します。不要な認証情報や秘密情報は共有しません。
        </p>

        <h2>外部サービス</h2>
        <p>
          認証、データベース、ホスティング、決済等の提供に必要な事業者へ、
          サービス提供に必要な範囲で情報処理を委託する場合があります。
        </p>

        <h2>保存と安全管理</h2>
        <p>
          アクセス制御、権限分離、監査ログ等を用いて情報を保護します。
          不要となった情報は、法令上または取引上保存が必要な期間を除き、
          合理的な方法で削除または匿名化します。
        </p>

        <h2>利用者の確認・修正・書き出し</h2>
        <p>
          利用者はアプリ内で自身のプロフィール等を確認・修正できます。
          アカウント画面から、自身に紐づく登録情報・取引履歴等をJSON形式で
          書き出すこともできます。削除・停止等の相談は運営窓口で本人確認のうえ対応します。
        </p>

        <h2>変更</h2>
        <p>
          重要な変更がある場合は、新しいバージョンへの同意を求めることがあります。
        </p>
      </article>
    </main>
  );
}
