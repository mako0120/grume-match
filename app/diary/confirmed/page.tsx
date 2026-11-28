import Link from "next/link";

export const metadata = { title: "日程確認完了｜グルメ日誌｜大阪", robots: { index: false, follow: false } };

export default function DiaryConfirmedPage() {
  return (
    <main className="diary-thanks">
      <span className="diary-overline">BOOKING CONFIRMED</span>
      <div className="diary-thanks-mark" aria-hidden="true">✓</div>
      <h1>PR訪問日程が<br /><em>確定しました。</em></h1>
      <p>ご確認ありがとうございます。グルメ日誌側にも確定情報が共有されます。投稿内容・料金については、確認済みの条件に沿って進行いたします。</p>
      <Link href="/diary" className="diary-button diary-button-primary">トップへ戻る ↗</Link>
    </main>
  );
}
