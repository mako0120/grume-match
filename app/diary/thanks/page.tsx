import Link from "next/link";

export default function DiaryThanksPage() {
  return (
    <main className="diary-thanks">
      <span className="diary-overline">THANK YOU</span>
      <div aria-hidden="true" className="diary-thanks-mark">✓</div>
      <h1>お問い合わせ<br /><em>ありがとうございます。</em></h1>
      <p>内容を確認のうえ、ご連絡いたします。返信まで少々お時間をいただく場合がございます。</p>
      <Link className="diary-button diary-button-primary" href="/diary">グルメ日誌のトップへ戻る ↗</Link>
    </main>
  );
}
