import Link from "next/link";

export default function OperatorPage() {
  const operatorName = process.env.NEXT_PUBLIC_OPERATOR_NAME?.trim() ?? "";
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ?? "";

  return (
    <main className="legal-shell">
      <article className="legal-document">
        <Link className="back-link" href="/legal/accept">← 確認画面へ</Link>
        <span className="eyebrow">OPERATOR</span>
        <h1>運営者情報</h1>

        <h2>サービス名</h2>
        <p>GOURMET DIARY PR OS</p>

        <h2>運営者</h2>
        <p>{operatorName || "一般公開前に設定します"}</p>

        <h2>お問い合わせ</h2>
        <p>{supportEmail || "一般公開前に設定します"}</p>

        <h2>サービス内容</h2>
        <p>
          飲食店とCreatorの有償PRについて、案件募集、応募、来店日時、
          投稿確認、報酬状態を管理するサービスです。
        </p>

        <h2>現在の決済方法</h2>
        <p>
          Private AlphaではCreator報酬を運営が外部で振り込み、
          実際の振込確認後にアプリ内の支払状態を更新します。
        </p>

        <p>
          課金方式や販売条件に応じて必要となる追加表示は、一般公開前に確定します。
        </p>
      </article>
    </main>
  );
}
