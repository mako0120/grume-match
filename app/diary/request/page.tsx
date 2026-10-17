import Link from "next/link";
import { DiaryInquiryForm } from "../components/inquiry-form";
import { DiaryHeader } from "../components/site-header";
import { DIARY_SERVICES } from "@/lib/diary/inquiry";
import { currentDiaryPricing, formatDiaryYen, videoIncludedPriceForFollowers } from "@/lib/diary/pricing";

export const metadata = {
  title: "無料相談・PR申込み｜グルメ日誌｜大阪",
  description: "グルメ日誌へのInstagram PR相談・お申し込み。無料の事前相談から始められます。",
};

export default async function DiaryRequestPage({ searchParams }: { searchParams: Promise<{ service?: string; intent?: string; goal?: string }> }) {
  const { service, intent, goal } = await searchParams;
  const goalLabel = goal === "new_menu" ? "新メニューを紹介したい" : goal === "first_visit" ? "初めてのお客様にお店を知ってほしい" : goal === "story" ? "お店のこだわりを伝えたい" : "";
  const initialKind = intent === "application" ? "application" : "consultation";
  const price = currentDiaryPricing();
  const initialService = DIARY_SERVICES.find((option) => option === service) ?? "";
  const enabled = process.env.DIARY_INQUIRIES_ENABLED === "true" &&
    !!process.env.DIARY_TURNSTILE_SECRET_KEY &&
    !!process.env.NEXT_PUBLIC_DIARY_TURNSTILE_SITE_KEY;

  return (
    <div className="diary-v2">
      <DiaryHeader active="request" />
      <main id="diary-main" className="diary-form-page">
        <div className="diary-v2-request-intro">
          <span className="diary-v2-section-label">START YOUR STORY / INQUIRY</span>
          <h1>お店の「伝えたい」を、<br /><em>聞かせてください。</em></h1>
          <p>事前相談だけでも大歓迎です。撮影・発信の内容、費用、希望日時を確認してから、ご納得いただける形をご提案します。</p>
        </div>
        <div className="diary-v2-request-summary">
          <div><span>写真フィードPR</span><strong>1投稿 {formatDiaryYen(price.amountYen)}</strong><small>税込・画像枚数による追加料金なし</small></div>
          <div><span>動画込みPR</span><strong>{formatDiaryYen(videoIncludedPriceForFollowers(price.followers))}〜</strong><small>税込・制作内容は個別見積もり</small></div>
          <Link href="/diary/services#pricing">プランを見る ↗</Link>
        </div>
        {goalLabel ? <p className="diary-v2-goal-context">ご相談テーマ：<strong>{goalLabel}</strong>（内容は自由に変更できます）</p> : null}
        <div className="diary-v2-request-note"><span aria-hidden="true">✳</span> 送信時点では契約は成立しません。日時・制作範囲・最終料金に双方が合意したあとに確定します。</div>
        <DiaryInquiryForm enabled={enabled} initialService={initialService} initialKind={initialKind} initialGoal={goalLabel} />
        <p className="diary-form-aside">ご入力いただく連絡先などはPR相談の対応にのみ利用します。<Link href="/legal/privacy">プライバシーポリシー</Link>をご確認ください。</p>
        <footer className="diary-footer diary-form-footer">
          <Link href="/diary">← グルメ日誌 トップへ戻る</Link>
          <Link href="/diary/policy">案件受注ポリシー</Link>
        </footer>
      </main>
    </div>
  );
}
