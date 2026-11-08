"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { validateDiaryInquiry } from "@/lib/diary/inquiry";
import {
  buildDiaryApplicationEmail,
  buildDiaryConsultationEmail,
  type DiaryEmailDraft,
  DIARY_PR_EMAIL,
} from "@/lib/diary/email-draft";

const SERVICES = [
  ["instagram_feed", "Instagram写真フィードPR"],
  ["instagram_feed_video", "写真フィード＋ショート動画PR"],
  ["instagram_reel", "リール動画（お見積もり）"],
  ["instagram_stories", "ストーリーズ（お見積もり）"],
  ["photo_video", "写真・動画素材の撮影（お見積もり）"],
  ["consultation", "相談して決めたい"],
] as const;

export function DiaryEmailInquiryFallback({
  initialService = "",
  initialKind = "consultation",
  initialGoal = "",
  photoFeedPriceYen,
  videoPackageStartYen,
}: {
  initialService?: string;
  initialKind?: "consultation" | "application";
  initialGoal?: string;
  photoFeedPriceYen: number;
  videoPackageStartYen: number;
}) {
  const [kind, setKind] = useState<"consultation" | "application">(initialKind);
  const [draft, setDraft] = useState<DiaryEmailDraft | null>(null);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const consultDraft = buildDiaryConsultationEmail();
  const startingService = SERVICES.some(([id]) => id === initialService) ? initialService : "instagram_feed";

  function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCopyStatus("");
    setDraft(null);
    const form = new FormData(event.currentTarget);
    const restaurant = String(form.get("restaurant_name") ?? "");
    const contact = String(form.get("contact_name") ?? "");
    const replyTo = String(form.get("email") ?? "");
    const service = String(form.get("service") ?? "");
    const coverage = String(form.get("desired_coverage") ?? "");
    const menu = String(form.get("featured_menu") ?? "");
    const visitPreference = String(form.get("visit_preference") ?? "");
    const message = String(form.get("message") ?? "");

    const result = validateDiaryInquiry({
      inquiry_kind: "application",
      restaurant_name: restaurant,
      contact_name: contact,
      email: replyTo,
      service,
      budget: "undecided",
      desired_coverage: coverage,
      featured_menu: menu,
      visit_preference: visitPreference,
      message,
      consent: form.get("consent") === "on",
      compliance_confirmed: form.get("compliance_confirmed") === "on",
    });
    if (!result.ok) {
      setError(result.error === "invalid_contact_details"
        ? "店舗名・担当者名・メールアドレス・ご依頼内容（10文字以上）を確認してください。"
        : result.error === "desired_coverage_required"
          ? "PRで伝えてほしいポイントをご入力ください。"
          : result.error.startsWith("口コミ") || result.error.startsWith("広告") || result.error.startsWith("評価")
            ? result.error
            : "入力内容・同意事項を確認してください。");
      return;
    }
    setDraft(buildDiaryApplicationEmail({
      restaurant: result.data.restaurant_name,
      contact: result.data.contact_name,
      replyTo: result.data.email,
      service: result.data.service,
      coverage: result.data.desired_coverage ?? "",
      menu: result.data.featured_menu ?? "",
      visitPreference: result.data.visit_preference ?? "",
      message: result.data.message,
    }));
  }

  async function copyDraft(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus("コピーしました。メールに貼り付けて送信できます。");
    } catch {
      setCopyStatus("自動コピーできませんでした。下の文面を選択してコピーしてください。");
    }
  }

  return (
    <section className="diary-email-fallback" aria-labelledby="diary-email-heading">
      <div className="diary-email-header">
        <span className="diary-v2-section-label">GMAIL / DIRECT PR REQUEST</span>
        <h2 id="diary-email-heading">メールで直接、<br /><em>PRのご相談。</em></h2>
        <p>ご相談内容が決まっていなくても大丈夫。すでにPRをご希望の場合は、詳細を入力してGmailのメール作成画面へ進めます。</p>
        <p className="diary-email-recipient">受付メール：<strong>{DIARY_PR_EMAIL}</strong></p>
      </div>

      <fieldset className="diary-inquiry-choice">
        <legend>ご相談方法を選択してください</legend>
        <div>
          <label className={kind === "consultation" ? "selected" : ""}>
            <input type="radio" name="diary_contact_kind" value="consultation" checked={kind === "consultation"} onChange={() => { setKind("consultation"); setDraft(null); }} />
            <strong>まずは無料相談</strong><small>料金や空き日程などをメールで質問</small>
          </label>
          <label className={kind === "application" ? "selected" : ""}>
            <input type="radio" name="diary_contact_kind" value="application" checked={kind === "application"} onChange={() => { setKind("application"); setDraft(null); }} />
            <strong>依頼内容が決まっている</strong><small>店舗情報・PR希望内容を入力する</small>
          </label>
        </div>
      </fieldset>

      {kind === "consultation" ? (
        <div className="diary-email-quick">
          <h3>Gmailで無料相談</h3>
          <p>{initialGoal ? "ご相談テーマ：" + initialGoal + "。 " : ""}メールを開いて、店舗名や相談内容を入力してください。</p>
          <div className="diary-email-actions">
            <a className="diary-button diary-button-primary" href={consultDraft.gmailUrl} target="_blank" rel="noopener noreferrer">Gmailで相談する ↗</a>
            <a className="diary-email-alt" href={consultDraft.mailtoUrl}>その他のメールアプリを使う ↗</a>
          </div>
          <p className="diary-email-note">メール作成画面が開きます。<strong>ご自身で送信するまで受付は完了しません。</strong></p>
        </div>
      ) : (
        <form className="diary-inquiry-form diary-email-application" onSubmit={submitApplication} onChange={() => { if (draft) setDraft(null); }}>
          <div className="diary-form-section-title"><span>01</span><h2>店舗・ご担当者様</h2></div>
          <div className="diary-input-grid">
            <label>店舗名 <em>必須</em>
              <input name="restaurant_name" required maxLength={100} autoComplete="organization" placeholder="例：大阪食堂" />
            </label>
            <label>ご担当者名 <em>必須</em>
              <input name="contact_name" required maxLength={80} autoComplete="name" placeholder="例：山田 太郎" />
            </label>
            <label>返信先メールアドレス <em>必須</em>
              <input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="hello@example.com" />
            </label>
            <label>希望PRプラン <em>必須</em>
              <select name="service" defaultValue={startingService} required>
                {SERVICES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}{value === "instagram_feed" ? "（" + photoFeedPriceYen.toLocaleString("ja-JP") + "円・税込）" :
                      value === "instagram_feed_video" ? "（" + videoPackageStartYen.toLocaleString("ja-JP") + "円〜・税込）" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="diary-form-section-title"><span>02</span><h2>PRのご希望</h2></div>
          <label>特に紹介してほしいポイント <em>必須</em>
            <textarea name="desired_coverage" required maxLength={320} rows={3} placeholder="例：季節限定メニュー、ランチの魅力、店内の雰囲気" />
          </label>
          <div className="diary-input-grid">
            <label>紹介希望の料理・コース <span>任意</span>
              <input name="featured_menu" maxLength={190} placeholder="例：名物コース" />
            </label>
            <label>来店候補日時 <span>任意</span>
              <input name="visit_preference" maxLength={190} placeholder="例：平日18時以降" />
            </label>
          </div>
          <label>依頼内容・ご相談の詳細 <em>必須</em>
            <textarea name="message" required minLength={10} maxLength={600} rows={4} placeholder="具体的なご希望や、質問などをご記入ください。" />
          </label>
          <details className="diary-compliance diary-policy-details">
            <summary>受注ポリシーを確認する</summary>
            <p>広告関係を隠した投稿、評価を指定する依頼、報酬・提供を条件にしたGoogleマップ・食べログへの口コミ依頼はお受けできません。</p>
            <Link href="/diary/policy">PR制作方針を見る ↗</Link>
          </details>
          <div className="diary-privacy-box">
            <label className="diary-privacy-check">
              <input type="checkbox" name="consent" required />
              <span><Link href="/legal/privacy" target="_blank" rel="noopener noreferrer">プライバシーポリシー</Link>に同意します。入力内容はメールの下書き作成にだけ利用し、このフォームからサーバーには送信されません。</span>
            </label>
            <label className="diary-privacy-check">
              <input type="checkbox" name="compliance_confirmed" required />
              <span><Link href="/diary/policy" target="_blank" rel="noopener noreferrer">受注ポリシー</Link>を確認し、禁止されている口コミ・広告関係の非表示などを依頼しません。</span>
            </label>
          </div>
          {error ? <p role="alert" className="diary-error">{error}</p> : null}
          <button className="diary-button diary-button-primary diary-submit" type="submit">入力内容を確認してGmailへ ↗</button>
          <p className="diary-submit-foot">この操作ではメールは送信されません。Gmailの画面で最終確認・送信をしてください。</p>
          {draft ? (
            <div className="diary-email-draft" role="status" aria-live="polite">
              <h3>入力内容の準備ができました</h3>
              <p>Gmailで下書きを開き、内容を確認して送信してください。</p>
              <div className="diary-email-actions">
                <a className="diary-button diary-button-primary" href={draft.gmailUrl} target="_blank" rel="noopener noreferrer">Gmailで申込みメールを開く ↗</a>
                <a className="diary-email-alt" href={draft.mailtoUrl}>他のメールアプリで開く ↗</a>
              </div>
              <label htmlFor="diary-email-preview">メール本文の確認</label>
              <textarea id="diary-email-preview" readOnly rows={10} value={draft.body} />
              <button type="button" className="diary-email-copy" onClick={() => { void copyDraft(draft.body); }}>メール本文をコピー</button>
              <p role="status" aria-live="polite">{copyStatus}</p>
            </div>
          ) : null}
        </form>
      )}
      <p className="diary-email-footer">メールアプリが利用できない場合は <a href="https://www.instagram.com/gurunavi_diary/" target="_blank" rel="noopener noreferrer">InstagramのDM</a> からもお問い合わせいただけます。<strong>ご相談のみで契約は成立しません。</strong></p>
    </section>
  );
}
