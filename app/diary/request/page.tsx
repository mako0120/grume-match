import Link from "next/link";
import { DiaryInquiryForm } from "../components/inquiry-form";
import { DIARY_SERVICES } from "@/lib/diary/inquiry";
import { currentDiaryPricing, formatDiaryYen } from "@/lib/diary/pricing";

export default async function DiaryRequestPage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const { service } = await searchParams;
  const price = currentDiaryPricing();
  const initialService = DIARY_SERVICES.find((option) => option === service) ?? "";
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
      <div className="diary-before-request">
        <span>BEFORE INQUIRY</span>
        <div>
          <strong>制作内容・投稿実例は確認済みですか？</strong>
          <p>どんなPRを依頼できるか、実際の投稿とサービス内容を事前に確認できます。</p>
        </div>
        <Link href="/diary/services">実例とサービスを見る ↗</Link>
      </div>
      <div className="diary-request-price">
        <span>現在のInstagramフィードPR基本料金</span>
        <strong>{formatDiaryYen(price.amountYen)}</strong>
        <p>1投稿・税込総額。フォロワー約{price.followers.toLocaleString("ja-JP")}人の時点での参考料金です。ご相談時の参考料金を記録しますが、正式な依頼内容・お支払い金額は双方の合意で確定します。</p>
      </div>
      <DiaryInquiryForm enabled={enabled} initialService={initialService} />
      <p className="diary-form-aside">発信内容・制作費・日程は双方で合意してから決定します。送信だけで契約は成立しません。</p>
      <footer className="diary-footer diary-form-footer">
        <Link href="/diary">グルメ日誌｜大阪</Link>
        <Link href="/legal/privacy">プライバシーポリシー</Link>
      </footer>
    </main>
  );
}
