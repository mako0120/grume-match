"use client";

import { useState, type FormEvent } from "react";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function DiaryInquiryForm({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const siteKey = process.env.NEXT_PUBLIC_DIARY_TURNSTILE_SITE_KEY;
  if (!enabled || !siteKey) {
    return (
      <div className="diary-form-unavailable">
        <h2>フォームは現在準備中です。</h2>
        <p>PRのご相談はInstagramのDMから承っています。</p>
        <a className="diary-button diary-button-primary" href="https://www.instagram.com/gurunavi_diary/" target="_blank" rel="noopener noreferrer">Instagramで相談する ↗</a>
      </div>
    );
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    setPending(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = {
      restaurant_name: data.get("restaurant_name"),
      contact_name: data.get("contact_name"),
      email: data.get("email"),
      phone: data.get("phone"),
      instagram_url: data.get("instagram_url"),
      service: data.get("service"),
      budget: data.get("budget"),
      desired_period: data.get("desired_period"),
      message: data.get("message"),
      consent: data.get("consent") === "on",
      website: data.get("website"),
      turnstileToken: data.get("cf-turnstile-response"),
    };
    try {
      const response = await fetch("/api/diary/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        setError(result.error || "送信に失敗しました。時間をおいて再度お試しください。");
        return;
      }
      router.replace("/diary/thanks");
    } catch {
      setError("通信エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="diary-inquiry-form" onSubmit={submit}>
      <div className="diary-form-section-title"><span>01</span><h2>お店・ご担当者様の情報</h2></div>
      <div className="diary-input-grid">
        <label>店舗・企業名 <em>必須</em>
          <input name="restaurant_name" required maxLength={100} placeholder="例：大阪食堂" autoComplete="organization" />
        </label>
        <label>ご担当者様のお名前 <em>必須</em>
          <input name="contact_name" required maxLength={80} placeholder="例：山田 太郎" autoComplete="name" />
        </label>
        <label>メールアドレス <em>必須</em>
          <input name="email" type="email" required maxLength={254} placeholder="hello@example.com" autoComplete="email" />
        </label>
        <label>お電話番号 <span>任意</span>
          <input name="phone" type="tel" maxLength={30} placeholder="06-1234-5678" autoComplete="tel" />
        </label>
      </div>
      <label>お店のInstagram URL <span>任意</span>
        <input name="instagram_url" type="url" maxLength={250} placeholder="https://www.instagram.com/..." />
      </label>
      <div className="diary-form-section-title"><span>02</span><h2>PRについてのご希望</h2></div>
      <div className="diary-input-grid">
        <label>ご希望の内容 <em>必須</em>
          <select name="service" defaultValue="" required>
            <option value="" disabled>選択してください</option>
            <option value="instagram_feed">Instagramフィード投稿</option>
            <option value="instagram_reel">Instagramリール</option>
            <option value="instagram_stories">ストーリーズ</option>
            <option value="photo_video">写真・動画素材の撮影</option>
            <option value="consultation">まずは相談したい</option>
          </select>
        </label>
        <label>ご予算の目安 <em>必須</em>
          <select name="budget" defaultValue="" required>
            <option value="" disabled>選択してください</option>
            <option value="undecided">相談して決めたい</option>
            <option value="under_10000">1万円未満</option>
            <option value="10000_30000">1万円〜3万円</option>
            <option value="30000_50000">3万円〜5万円</option>
            <option value="over_50000">5万円以上</option>
          </select>
        </label>
      </div>
      <label>ご希望の時期 <span>任意</span>
        <input name="desired_period" maxLength={120} placeholder="例：11月中、日程は相談" />
      </label>
      <label>お店の魅力・ご相談内容 <em>必須</em>
        <textarea name="message" required minLength={10} maxLength={2000} rows={6} placeholder="お店の特徴、紹介してほしいメニュー、ご希望の投稿イメージなどを自由にお書きください。" />
      </label>
      <div className="diary-honeypot" aria-hidden="true">
        <label>Webサイト <input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="diary-privacy-box">
        <label className="diary-privacy-check">
          <input type="checkbox" name="consent" required />
          <span><Link href="/legal/privacy" target="_blank" rel="noopener noreferrer">プライバシーポリシー</Link>に同意して送信します。入力した情報はPR相談への対応に利用されます。</span>
        </label>
        <div className="cf-turnstile" data-sitekey={siteKey} />
      </div>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      {error ? <p role="alert" className="diary-error">{error}</p> : null}
      <button className="diary-button diary-button-primary diary-submit" type="submit" disabled={pending}>{pending ? "送信中..." : "無料でPRを相談する"} <span>↗</span></button>
      <p className="diary-submit-foot">送信後に自動的な課金・契約は発生しません。</p>
    </form>
  );
}
