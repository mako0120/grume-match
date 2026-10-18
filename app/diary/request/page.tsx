import Link from "next/link";
import { DiaryInquiryForm } from "../components/inquiry-form";
import { DiaryHeader } from "../components/site-header";
import { DIARY_SERVICES } from "@/lib/diary/inquiry";
import { currentDiaryPricing, formatDiaryYen, videoIncludedPriceForFollowers } from "@/lib/diary/pricing";

export const metadata = {
  title: "無料相談・PR申込み｜グルメ日誌｜大阪",
  description: "グルメ日誌へのInstagram PR相談・お申し込み。フォーム準備中もInstagramのDMから無料で相談できます。",
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
  // Netlify-hosted first-party enquiries need no Supabase or custom mail API.
  // Form detection and notifications must be enabled in the Netlify site dashboard.
  const netlifyEnabled = process.env.DIARY_SITE_MODE === "true";
  const acceptingForm = enabled || netlifyEnabled;

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
        <div className="diary-v2-request-note"><span aria-hidden="true">✳</span> {acceptingForm ? "無料のフォームからご相談いただけます。送信時点では契約は成立しません。" : "現在はInstagramのDMから無料でご相談いただけます。DMを送っただけでは契約は成立しません。"} 日時・制作範囲・最終料金に双方が合意したあとに確定します。</div>
        <DiaryInquiryForm enabled={enabled} netlifyEnabled={netlifyEnabled} initialService={initialService} initialKind={initialKind} initialGoal={goalLabel} />
        <p className="diary-form-aside">{acceptingForm ? "送信いただいた情報はご相談・お見積もり・返信のために利用します。" : "DMの文章をコピーしても、当サイトから個人情報が送信されることはありません。"}<Link href="/legal/privacy">プライバシーポリシー</Link>をご確認ください。</p>
        <footer className="diary-footer diary-form-footer">
          <Link href="/diary">← グルメ日誌 トップへ戻る</Link>
          <Link href="/diary/policy">案件受注ポリシー</Link>
        </footer>
      </main>
    </div>
  );
}
