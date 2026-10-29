"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { detectProhibitedPRRequest, validateDiaryInquiry } from "@/lib/diary/inquiry";

/**
 * Netlify Forms stores these leads in the site's protected Netlify dashboard.
 * public/__forms.html declares exactly the keys that Netlify accepts.
 * Client validation is for UX; every lead still requires human PR-policy review.
 */
const FORM_NAME = "diary-pr-inquiry";
const REGISTERED_FIELDS = [
  "inquiry_kind", "restaurant_name", "contact_name", "email",
  "service", "goal", "featured_menu", "visit_preference", "message",
  "consent", "compliance_confirmed", "bot-field",
] as const;

const SERVICE_OPTIONS = [
  { value: "instagram_feed", title: "Instagram写真フィード1投稿" },
  { value: "instagram_feed_video", title: "写真フィード＋ショート動画" },
  { value: "monthly_photo", title: "毎月フォトPR（月29,800円・税込／ご相談）" },
  { value: "monthly_growth", title: "毎月フォト＋リールPR（月49,800円・税込／ご相談）" },
  { value: "instagram_reel", title: "リール単体（個別見積もり）" },
  { value: "instagram_stories", title: "ストーリーズ（個別見積もり）" },
  { value: "photo_video", title: "写真・動画素材の撮影（個別見積もり）" },
  { value: "consultation", title: "まだ決めていない・相談したい" },
] as const;

export function NetlifyDiaryInquiryForm({
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
  const router = useRouter();
  const [kind, setKind] = useState<"consultation" | "application">(initialKind);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // Prices come from the server-side verified pricing snapshot shown on the
  // landing page; never maintain a second hardcoded quote in a client form.
  const serviceOptions = SERVICE_OPTIONS.map(option =>
    option.value === "instagram_feed"
      ? { ...option, title: option.title + "（" + photoFeedPriceYen.toLocaleString("ja-JP") + "円・税込）" }
      : option.value === "instagram_feed_video"
        ? { ...option, title: option.title + "（" + videoPackageStartYen.toLocaleString("ja-JP") + "円〜・税込）" }
        : option);
  const selectedService = serviceOptions.some((entry) => entry.value === initialService)
    ? initialService : (initialKind === "application" ? "instagram_feed" : "consultation");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const message = String(formData.get("message") ?? "").trim();
    const restaurant = String(formData.get("restaurant_name") ?? "").trim();
    const contact = String(formData.get("contact_name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const service = String(formData.get("service") ?? "consultation");
    const featuredMenu = String(formData.get("featured_menu") ?? "");
    const visitPreference = String(formData.get("visit_preference") ?? "");
    const checked = validateDiaryInquiry({
      inquiry_kind: kind,
      restaurant_name: restaurant,
      contact_name: contact,
      email,
      service,
      budget: "undecided",
      desired_coverage: kind === "application" ? message : "",
      featured_menu: featuredMenu,
      visit_preference: visitPreference,
      message,
      consent: formData.get("consent") === "on",
      compliance_confirmed: formData.get("compliance_confirmed") === "on",
    });
    if (!checked.ok) {
      setError(checked.error === "invalid_contact_details"
        ? "店舗名・お名前・メールアドレス・相談内容（10文字以上）を確認してください。"
        : checked.error === "desired_coverage_required"
          ? "PRで紹介してほしい内容を入力してください。"
          : checked.error.startsWith("口コミ") || checked.error.startsWith("広告") || checked.error.startsWith("評価")
            ? checked.error
            : "入力内容と同意事項をご確認ください。");
      return;
    }

    const unsafe = detectProhibitedPRRequest([restaurant, message, featuredMenu, visitPreference].join(" "));
    if (unsafe) { setError(unsafe); return; }

    setPending(true);
    setError("");
    try {
      const body = new URLSearchParams();
      body.set("form-name", FORM_NAME);
      for (const field of REGISTERED_FIELDS) {
        const value = formData.get(field);
        if (typeof value === "string") body.set(field, value);
      }
      // OpenNext requires POST to the physical static HTML form, not a Next.js route.
      const response = await fetch("/__forms.html", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        cache: "no-store",
      });
      if (!response.ok) {
        setError("送信を受け付けられませんでした。InstagramのDMからお問い合わせください。");
        return;
      }
      router.replace("/diary/thanks");
    } catch {
      setError("ネットワークエラーが発生しました。InstagramのDMからお問い合わせください。");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="diary-inquiry-form diary-netlify-inquiry" method="POST" name={FORM_NAME} onSubmit={(event) => { void submit(event); }}>
      <input type="hidden" name="form-name" value={FORM_NAME} />
      <input type="hidden" name="goal" value={initialGoal} />
      <fieldset className="diary-inquiry-choice">
        <legend>まずは相談しますか？ プランの申込みを検討していますか？</legend>
        <div>
          <label className={kind === "consultation" ? "selected" : ""}>
            <input type="radio" name="inquiry_kind" value="consultation" checked={kind === "consultation"} onChange={() => setKind("consultation")} />
            <strong>まずは無料相談</strong><small>まだ決まっていなくても大丈夫です</small>
          </label>
          <label className={kind === "application" ? "selected" : ""}>
            <input type="radio" name="inquiry_kind" value="application" checked={kind === "application"} onChange={() => setKind("application")} />
            <strong>プランを申し込む</strong><small>希望を伝えて見積もりを受け取る</small>
          </label>
        </div>
      </fieldset>
      <div className="diary-conversion-intro">
        <span>複雑な撮影指示は必要ありません</span>
        <p>料理や店内の魅力を、いつものグルメ日誌のInstagram投稿としてご紹介します。まずは連絡先と相談内容を教えてください。</p>
      </div>
      <div className="diary-form-section-title"><span>01</span><h2>店舗・ご担当者様</h2></div>
      <div className="diary-input-grid">
        <label>店舗・企業名 <em>必須</em>
          <input name="restaurant_name" required maxLength={100} autoComplete="organization" placeholder="例：大阪食堂" />
        </label>
        <label>ご担当者様 <em>必須</em>
          <input name="contact_name" required maxLength={80} autoComplete="name" placeholder="例：山田 太郎" />
        </label>
        <label>返信先メールアドレス <em>必須</em>
          <input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="hello@example.com" />
        </label>
        <label>PRのご希望 <em>必須</em>
          <select name="service" defaultValue={selectedService} required>
            {serviceOptions.map((item) => <option key={item.value} value={item.value}>{item.title}</option>)}
          </select>
        </label>
      </div>
      <div className="diary-form-section-title"><span>02</span><h2>紹介したい内容</h2></div>
      <label>ご相談内容 <em>必須</em>
        <textarea name="message" required minLength={10} maxLength={2000} rows={5} placeholder={initialGoal ? `例：${initialGoal}です。詳細な撮影はお任せしたいので、料金と日程をご相談したいです。` : "例：新しいランチメニューをInstagramで紹介してほしいです。料金と来店できる日を教えてください。"} />
      </label>
      <details className="diary-extra-details">
        <summary>紹介メニューや来店候補日も伝える（任意） <span aria-hidden="true">＋</span></summary>
        <div className="diary-extra-details-body">
          <label>紹介したいメニュー <span>任意</span><input name="featured_menu" maxLength={500} placeholder="例：季節の限定コース" /></label>
          <label>来店の候補日時 <span>任意</span><textarea name="visit_preference" maxLength={600} rows={2} placeholder="例：平日18時以降。未定でも大丈夫です。" /></label>
        </div>
      </details>
      <details className="diary-compliance diary-policy-details">
        <summary>お受けできないPR案件について <span aria-hidden="true">＋</span></summary>
        <p>食べログ・Googleマップへの報酬付き口コミ、高評価の指定、PR表記を隠した投稿はお受けしません。制作時は一般のお客様の顔・声・個人情報の写り込みにも配慮します。</p>
        <Link href="/diary/policy">案件受注・撮影ポリシー ↗</Link>
      </details>
      <div className="diary-honeypot" aria-hidden="true">
        <label>この項目は入力しないでください<input name="bot-field" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="diary-privacy-box">
        <label className="diary-privacy-check">
          <input name="consent" type="checkbox" required />
          <span><Link href="/legal/privacy" target="_blank" rel="noopener noreferrer">プライバシーポリシー</Link>に同意します。お問い合わせ内容はNetlify Formsに保管され、当サイト運営者が返信のために利用します。</span>
        </label>
        <label className="diary-privacy-check">
          <input name="compliance_confirmed" type="checkbox" required />
          <span><Link href="/diary/policy" target="_blank" rel="noopener noreferrer">案件受注ポリシー</Link>を確認しました。禁止されている口コミ投稿・評価指定・ステルスマーケティングは依頼しません。</span>
        </label>
      </div>
      {error ? <p role="alert" aria-live="assertive" className="diary-error">{error} <a href="https://www.instagram.com/gurunavi_diary/" target="_blank" rel="noopener noreferrer">Instagramで相談する ↗</a></p> : null}
      <button className="diary-button diary-button-primary diary-submit" disabled={pending} type="submit">{pending ? "送信中..." : kind === "consultation" ? "無料でPR相談する" : "PR申込みを送信する"} <span aria-hidden="true">↗</span></button>
      <p className="diary-submit-foot">送信は無料です。内容を確認してメールでお返事します。フォームの送信だけでは契約は成立しません。料金・訪問日時・制作範囲は契約前に合意します。</p>
      <p className="diary-netlify-fallback">返信が届かない場合は <a href="https://www.instagram.com/gurunavi_diary/" target="_blank" rel="noopener noreferrer">InstagramのDM</a> でもお問い合わせいただけます。</p>
    </form>
  );
}
