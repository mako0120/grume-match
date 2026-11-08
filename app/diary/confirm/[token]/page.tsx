import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { bookingTokenHash, formatTokyoVisit } from "@/lib/diary/booking";
import { confirmDiaryBooking } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "PR訪問日時の確認｜グルメ日誌｜大阪", robots: { index: false, follow: false } };

export default async function ConfirmVisitPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const hash = bookingTokenHash(token);
  if (!hash) notFound();
  const admin = createAdminClient();
  const { data } = await admin.from("diary_pr_inquiries")
    .select("restaurant_name,service,proposed_visit_at,proposed_visit_duration_minutes,proposed_deliverables,agreed_fee_yen,payment_terms,proposal_expires_at")
    .eq("proposal_token_hash", hash).eq("status", "proposed")
    .eq("inquiry_kind", "application").eq("compliance_status", "approved")
    .gt("proposal_expires_at", new Date().toISOString()).maybeSingle();
  if (!data) return <main className="diary-thanks"><h1>この確認リンクは無効または期限切れです。</h1><p>訪問日時の確認が必要な場合は、グルメ日誌へご連絡ください。</p><Link href="/diary">トップへ戻る</Link></main>;
  return (
    <main className="diary-form-page" style={{ maxWidth: 680, paddingTop: 60 }}>
      <span className="diary-overline">VISIT CONFIRMATION</span>
      <h1>訪問日時とPR内容をご確認ください。</h1>
      <div className="diary-inquiry-form">
        <p><strong>店舗：</strong>{data.restaurant_name}</p>
        <p><strong>訪問日時：</strong>{formatTokyoVisit(data.proposed_visit_at)}（{data.proposed_visit_duration_minutes}分を予定）</p>
        <p><strong>制作内容：</strong>{data.proposed_deliverables}</p>
        <p><strong>合意予定の報酬：</strong>{Number(data.agreed_fee_yen).toLocaleString("ja-JP")}円（税込）</p>
        <p><strong>支払い：</strong>{data.payment_terms === "split_50_50" ? "案件確定時50％＋公開後7日以内50％" : "投稿公開後7日以内に全額支払い"}</p>
        <p style={{ fontSize: 12, lineHeight: 1.9 }}>上記の訪問日時、制作内容、料金、支払い条件に同意すると、案件が正式確定しグルメ日誌に通知されます。食べログ・Googleマップ等への対価付き口コミは含まれず、InstagramではPR関係を明示します。</p>
        <form action={confirmDiaryBooking}>
          <input type="hidden" name="token" value={token} />
          <label style={{ display: "flex", gap: 9, alignItems: "start" }}>
            <input type="checkbox" name="accepted" required />
            <span>日時・料金・制作範囲・支払い条件および<Link href="/diary/policy">PRポリシー</Link>に同意します。</span>
          </label>
          <button type="submit" className="diary-button diary-button-primary" style={{ width: "100%", marginTop: 22 }}>この日時で案件を確定する ↗</button>
        </form>
        <p style={{ fontSize: 12, color: "#657269" }}>変更をご希望の場合、確定せずに返信メールから再調整してください。</p>
      </div>
    </main>
  );
}
