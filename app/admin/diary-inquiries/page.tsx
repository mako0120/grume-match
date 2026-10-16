import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateDiaryInquiryStatus, reviewDiaryInquiryCompliance } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const serviceLabels: Record<string, string> = {
  instagram_feed: "フィード投稿",
  instagram_reel: "リール",
  instagram_stories: "ストーリーズ",
  photo_video: "写真・動画素材",
  consultation: "まずは相談",
};
const budgetLabels: Record<string, string> = {
  undecided: "相談して決める",
  under_10000: "1万円未満",
  "10000_30000": "1〜3万円",
  "30000_50000": "3〜5万円",
  over_50000: "5万円以上",
};
const statusLabels: Record<string, string> = {
  new: "未対応", contacted: "連絡済み", proposed: "提案済み", booked: "成約", closed: "終了",
};

export default async function DiaryInquiriesAdmin() {
  // Parent /admin layout enforces authenticated active admin.
  const admin = createAdminClient();
  const { data: inquiries, error } = await admin
    .from("diary_pr_inquiries")
    .select("id,restaurant_name,contact_name,email,phone,instagram_url,service,budget,desired_period,message,status,compliance_status,compliance_reviewed_at,compliance_policy_version,created_at")
    .order("created_at", { ascending: false }).limit(100);

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>グルメ日誌｜大阪</strong>
        <nav className="mini-nav">
          <Link href="/admin">運営ホーム</Link>
          <Link href="/diary">営業サイト</Link>
        </nav>
      </header>
      <span className="eyebrow">DIRECT PR INQUIRIES</span>
      <h1 className="page-title">グルメ日誌へのPR依頼</h1>
      <p className="page-subtitle">グルメ日誌本人宛ての相談専用受信箱です。マッチング案件とは分けて管理します。</p>
      <section className="admin-count">
        <span>新規お問い合わせ</span>
        <strong>{(inquiries ?? []).filter((row) => row.status === "new").length}</strong>
        <small>件</small>
      </section>
      {error ? (
        <p className="form-message error-message">データベースの準備が必要です。migrationの適用状況をご確認ください。</p>
      ) : !inquiries?.length ? (
        <section className="section-card"><strong>まだお問い合わせはありません。</strong><p>営業用リンクを店舗に共有すると、この画面に依頼が届きます。</p></section>
      ) : (
        <div className="campaign-list">
          {inquiries.map((item) => (
            <article className="section-card" key={item.id}>
              <div className="campaign-topline">
                <span className="meta-pill">{statusLabels[item.status] ?? item.status}</span>
                <span className="field-caption">{new Date(item.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</span>
              </div>
              <h2>{item.restaurant_name}</h2>
              <p><strong>担当：</strong>{item.contact_name}</p>
              <p><strong>メール：</strong><a href={"mailto:" + item.email}>{item.email}</a></p>
              {item.phone && <p><strong>電話：</strong>{item.phone}</p>}
              {item.instagram_url && <p><strong>Instagram：</strong><a href={item.instagram_url} rel="noreferrer noopener" target="_blank">店舗アカウントを開く ↗</a></p>}
              <p><strong>依頼内容：</strong>{serviceLabels[item.service] ?? item.service}</p>
              <p><strong>予算目安：</strong>{budgetLabels[item.budget] ?? item.budget}</p>
              {item.desired_period && <p><strong>希望時期：</strong>{item.desired_period}</p>}
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{item.message}</p>
              <section style={{ background: "#fff9e8", padding: 16, borderRadius: 12, marginTop: 16 }}>
                <strong>契約前のコンプライアンス審査：{item.compliance_status === "approved" ? "承認済み" : item.compliance_status === "rejected" ? "お断り" : "未審査"}</strong>
                {item.compliance_reviewed_at ? (
                  <p>審査日：{new Date(item.compliance_reviewed_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</p>
                ) : null}
                <p>食べログ・Googleマップ等の口コミ依頼なし／高評価指定なし／適切なPR表示あり／事実と体験に基づく内容かを確認してください。</p>
                <p><Link href="/diary/policy" target="_blank">受注ポリシーを確認 ↗</Link></p>
                {item.compliance_status === "pending" && (
                  <form action={reviewDiaryInquiryCompliance}>
                    <input type="hidden" name="id" value={item.id} />
                    <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <input type="checkbox" name="review_confirmed" required />
                      <span>禁止事項と依頼内容を確認しました</span>
                    </label>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button type="submit" name="decision" value="approved" className="secondary-button">審査に承認</button>
                      <button type="submit" name="decision" value="rejected" className="secondary-button">お断り・終了</button>
                    </div>
                  </form>
                )}
              </section>
              <form action={updateDiaryInquiryStatus} style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
                <input type="hidden" name="id" value={item.id} />
                <select name="status" aria-label={item.restaurant_name + "の対応状況"} defaultValue={item.status}>
                  <option value="new">未対応</option>
                  <option value="contacted">連絡済み</option>
                  <option value="proposed" disabled={item.compliance_status !== "approved"}>提案済み（審査後）</option>
                  <option value="booked" disabled={item.compliance_status !== "approved"}>成約（審査後）</option>
                  <option value="closed">終了</option>
                </select>
                <button className="secondary-button" type="submit" disabled={item.compliance_status !== "approved" && ["proposed", "booked"].includes(item.status)}>状態を保存</button>
              </form>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
