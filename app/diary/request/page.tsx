import Link from "next/link";
import { DiaryInquiryForm } from "../components/inquiry-form";

export default function DiaryRequestPage() {
  const enabled = process.env.DIARY_INQUIRIES_ENABLED === "true" &&
    !!process.env.DIARY_TURNSTILE_SECRET_KEY &&
    !!process.env.NEXT_PUBLIC_DIARY_TURNSTILE_SITE_KEY;
  return (
    <main className="diary-form-page">
      <Link className="diary-back" href="/diary">← グルメ日誌へ戻る</Link>
      <div className="diary-form-head">
        <span className="diary-overline"><span className="diary-dot" /> PR INQUIRY</span>
        <h1>お店の魅力を、<br /><em>一緒に届けませんか。</em></h1>
        <p>ご相談・お見積もりは無料です。お店のこと、伝えたいことをぜひ聞かせてください。</p>
      </div>
      <DiaryInquiryForm enabled={enabled} />
      <p className="diary-form-aside">発信内容・制作費・日程は双方で合意してから決定します。送信だけで契約は成立しません。</p>
      <footer className="diary-footer diary-form-footer">
        <Link href="/diary">グルメ日誌｜大阪</Link>
        <Link href="/legal/privacy">プライバシーポリシー</Link>
      </footer>
    </main>
  );
}
