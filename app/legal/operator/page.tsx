import Link from "next/link";

export default function OperatorPage() {
  const operatorName = process.env.NEXT_PUBLIC_OPERATOR_NAME?.trim() ?? "";
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ?? "";

  if (process.env.DIARY_SITE_MODE === "true") {
    return (
      <main className="legal-shell">
        <article className="legal-document">
          <Link className="back-link" href="/diary">← グルメ日誌へ戻る</Link>
          <span className="eyebrow">GOURMET DIARY OSAKA</span>
          <h1>運営者情報</h1>
          <h2>サービス名</h2><p>グルメ日誌｜大阪（Instagram PR・撮影）</p>
          <h2>運営者</h2><p>{operatorName || "運営者情報を確認中"}</p>
          <h2>お問い合わせ</h2><p>{supportEmail || "お問い合わせ先を確認中"}</p>
          <h2>提供サービスと料金</h2>
          <p>飲食店向けInstagramフィード投稿のPR制作：8,000円（税込）から。動画を含むPR：15,000円（税込）から。正確な制作範囲・価格・来店日時は契約前に双方で合意します。</p>
          <h2>支払い方法と時期</h2>
          <p>撮影・投稿後にStripe請求書をご案内し、投稿公開後7日以内にお支払いいただく後払い方式です。お申込みフォームの送信だけでは契約は成立せず、日時・制作内容・価格に同意後に正式決定します。</p>
          <h2>キャンセル・変更</h2>
          <p>訪問日時・制作範囲の変更やキャンセルについては、契約前に個別の条件をご確認ください。</p>
        </article>
      </main>
    );
  }

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
