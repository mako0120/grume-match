import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateDiaryInquiryStatus, reviewDiaryInquiryCompliance, proposeDiaryVisit, markDiaryPostPublished, markDiaryPaymentReceived } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const serviceLabels: Record<string, string> = {
  instagram_feed: "フィード投稿",
  instagram_feed_video: "フィード＋ショート動画",
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
    .select("id,restaurant_name,contact_name,email,phone,instagram_url,service,budget,desired_period,post_price_reference_yen,followers_at_inquiry,follower_snapshot_verified_at,price_policy_version,message,status,compliance_status,compliance_reviewed_at,compliance_policy_version,created_at,inquiry_kind,desired_coverage,featured_menu,requested_outcome,visit_preference,proposed_visit_at,proposed_visit_duration_minutes,proposed_deliverables,agreed_fee_yen,payment_terms,proposal_expires_at,proposal_email_state,confirmed_at,operator_notify_state,operator_notified_at,published_at,published_post_url,payment_due_at,payment_received_at")
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
              {item.post_price_reference_yen != null ? (
                <p><strong>申込み時の基本料金：</strong>{item.post_price_reference_yen.toLocaleString("ja-JP")}円（税込総額・参考）
                  {" ／ "}フォロワー {item.followers_at_inquiry?.toLocaleString("ja-JP") ?? "未記録"}人
                  {" ／ "}確認日 {item.follower_snapshot_verified_at || "不明"}
                </p>
              ) : <p><strong>基本料金：</strong>このサービスは個別見積もり</p>}
              {item.desired_period && <p><strong>希望時期：</strong>{item.desired_period}</p>}
              <p><strong>受付区分：</strong>{item.inquiry_kind === "application" ? "プラン申込み（日程調整希望）" : "事前相談"}</p>
              {item.desired_coverage && <p><strong>紹介希望内容：</strong>{item.desired_coverage}</p>}
              {item.featured_menu && <p><strong>紹介希望メニュー：</strong>{item.featured_menu}</p>}
              {item.requested_outcome && <p><strong>PRの目的：</strong>{item.requested_outcome}</p>}
              {item.visit_preference && <p><strong>店舗の候補日時：</strong>{item.visit_preference}</p>}
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
              {item.inquiry_kind === "application" && item.compliance_status === "approved" && ["new", "contacted", "proposed"].includes(item.status) && (
                <section className="section-card" style={{ padding: 18, marginTop: 20, background: "#eff7ee" }}>
                  <h3>グルメ日誌から店舗へ日時を提案</h3>
                  <p>企業へ日時・制作内容・税込報酬・支払条件をメールで送り、専用リンクから承諾してもらいます。承諾されるまでは案件は確定しません。</p>
                  <form action={proposeDiaryVisit} style={{ display: "grid", gap: 12 }}>
                    <input type="hidden" name="id" value={item.id} />
                    <label>訪問日時（日本時間）<input required type="datetime-local" name="visit_datetime" /></label>
                    <label>撮影・滞在時間
                      <select name="duration_minutes" defaultValue="120">
                        <option value="60">60分</option><option value="90">90分</option>
                        <option value="120">120分</option><option value="180">180分</option>
                        <option value="240">240分</option>
                      </select>
                    </label>
                    <label>提案報酬（税込・円）
                      <input type="number" name="agreed_fee_yen" min={item.post_price_reference_yen ?? 8000} max="1000000" step="1" required defaultValue={item.agreed_fee_yen ?? item.post_price_reference_yen ?? 8000} />
                    </label>
                    <label>制作・投稿範囲（具体的に記入）
                      <textarea name="deliverables" minLength={20} maxLength={2000} rows={4} required defaultValue={item.proposed_deliverables ?? ""} placeholder="Instagramフィード1投稿。撮影する料理、画像枚数、修正、PR表記、素材利用範囲など" />
                    </label>
                    <p>支払い：投稿公開後7日以内に全額（税込）。撮影日時・料金・制作範囲のすべてに同意後、案件確定。</p>
                    <button type="submit" className="secondary-button">店舗に日時・条件を提案する</button>
                    {item.proposal_email_state !== "none" && <small>前回送信：{item.proposal_email_state === "sent" ? "送信済み" : item.proposal_email_state === "failed" ? "送信失敗（再提案可能）" : "処理中"} {item.proposal_expires_at && "／ 有効期限 " + new Date(item.proposal_expires_at).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}</small>}
                  </form>
                </section>
              )}
              {item.status === "booked" && (
                <section className="section-card" style={{ padding: 18, background: "#eef5ed", marginTop: 20 }}>
                  <h3>確定済み案件</h3>
                  <p><strong>訪問：</strong>{item.proposed_visit_at && new Date(item.proposed_visit_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</p>
                  <p><strong>報酬：</strong>{Number(item.agreed_fee_yen).toLocaleString("ja-JP")}円（税込）</p>
                  <p><strong>制作範囲：</strong>{item.proposed_deliverables}</p>
                  <p><strong>確定通知：</strong>{item.operator_notify_state === "sent" ? "メール送信済み" : "送信待ちまたは失敗（cronで再試行）"}</p>
                  {!item.published_at ? (
                    <form action={markDiaryPostPublished} style={{ display: "grid", gap: 10 }}>
                      <input type="hidden" name="id" value={item.id} />
                      <label>公開したInstagram投稿URL<input type="url" name="post_url" required placeholder="https://www.instagram.com/p/..." /></label>
                      <button type="submit" className="secondary-button">投稿公開済みにする・支払期限を設定</button>
                    </form>
                  ) : (
                    <>
                      <p><strong>公開投稿：</strong><a href={item.published_post_url} target="_blank" rel="noopener noreferrer">{item.published_post_url}</a></p>
                      <p><strong>支払期限：</strong>{item.payment_due_at && new Date(item.payment_due_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</p>
                      {item.payment_received_at ? <p><strong>入金確認済み：</strong>{new Date(item.payment_received_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</p> :
                      <form action={markDiaryPaymentReceived}>
                        <input type="hidden" name="id" value={item.id} />
                        <button type="submit" className="secondary-button">入金を確認した</button>
                      </form>}
                    </>
                  )}
                </section>
              )}
                            <form action={updateDiaryInquiryStatus} style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
                <input type="hidden" name="id" value={item.id} />
                <select name="status" aria-label={item.restaurant_name + "の対応状況"} defaultValue={item.status}>
                  <option value="new">未対応</option>
                  <option value="contacted">連絡済み</option>
                  <option value="proposed" disabled>提案中（日時提案フォームから）</option>
                  <option value="booked" disabled>成約（企業確認リンクから）</option>
                  <option value="closed">終了</option>
                </select>
                <button className="secondary-button" type="submit" disabled={["proposed", "booked", "closed"].includes(item.status)}>状態を保存</button>
              </form>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
