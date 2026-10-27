"use client";

import { useState, type FormEvent } from "react";
import Script from "next/script";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InstagramDmFallback } from "./instagram-dm-fallback";
import { NetlifyDiaryInquiryForm } from "./netlify-inquiry-form";

export function DiaryInquiryForm({ enabled, netlifyEnabled = false, initialService = "", initialKind = "consultation", initialGoal = "", photoFeedPriceYen, videoPackageStartYen }: {
  enabled: boolean; netlifyEnabled?: boolean; initialService?: string;
  initialKind?: "consultation" | "application"; initialGoal?: string;
  photoFeedPriceYen: number; videoPackageStartYen: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [inquiryKind, setInquiryKind] = useState<"consultation" | "application">(initialKind);
  const [error, setError] = useState("");
  const siteKey = process.env.NEXT_PUBLIC_DIARY_TURNSTILE_SITE_KEY;
  if (!enabled || !siteKey) {
    if (netlifyEnabled) {
      return <NetlifyDiaryInquiryForm initialService={initialService} initialKind={initialKind} initialGoal={initialGoal} photoFeedPriceYen={photoFeedPriceYen} videoPackageStartYen={videoPackageStartYen} />;
    }
    return <InstagramDmFallback initialService={initialService} initialKind={initialKind} initialGoal={initialGoal} />;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    setPending(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = {
      inquiry_kind: data.get("inquiry_kind"),
      desired_coverage: data.get("desired_coverage"),
      featured_menu: data.get("featured_menu"),
      requested_outcome: data.get("requested_outcome"),
      visit_preference: data.get("visit_preference"),
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
      compliance_confirmed: data.get("compliance_confirmed") === "on",
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
      <fieldset className="diary-inquiry-choice">
        <legend>まずはご相談ですか？ 具体的なPRのお申し込みですか？</legend>
        <div>
          <label className={inquiryKind === "consultation" ? "selected" : ""}>
            <input type="radio" name="inquiry_kind" value="consultation" checked={inquiryKind === "consultation"} onChange={() => setInquiryKind("consultation")} />
            <strong>まずは事前相談</strong><small>内容やお見積もりから確認したい</small>
          </label>
          <label className={inquiryKind === "application" ? "selected" : ""}>
            <input type="radio" name="inquiry_kind" value="application" checked={inquiryKind === "application"} onChange={() => setInquiryKind("application")} />
            <strong>プランを申し込む</strong><small>希望内容を送って日程の提案を受けたい</small>
          </label>
        </div>
      </fieldset>
      <div className="diary-conversion-intro">
        <span>ご相談に必要な内容だけで大丈夫です</span>
        <p>{inquiryKind === "consultation" ? "まずは店舗名・連絡先・相談したいことだけ。撮影方法の細かい指定は不要です。" : "普段のInstagram投稿として制作します。伝えてほしい料理・ポイントと来店可能な日時を教えてください。"}</p>
      </div>
      <div className="diary-form-section-title"><span>01</span><h2>お店・ご担当者様</h2></div>
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
        {inquiryKind === "application" ? (
          <label>お電話番号 <span>任意</span>
            <input name="phone" type="tel" maxLength={30} placeholder="例：06-1234-5678" autoComplete="tel" />
          </label>
        ) : null}
      </div>
      {inquiryKind === "application" ? (
        <>
          <label>お店のInstagram URL <span>任意</span>
            <input name="instagram_url" type="url" maxLength={250} placeholder="https://www.instagram.com/..." />
          </label>
          <div className="diary-form-section-title"><span>02</span><h2>PRのご希望</h2></div>
          <p className="diary-brief-help">グルメ日誌本人へのご依頼です。<Link href="/diary/services">サービス内容とInstagramの投稿実例を見る ↗</Link></p>
          <div className="diary-input-grid">
            <label>ご希望の内容 <em>必須</em>
              <select name="service" defaultValue={initialService} required>
                <option value="" disabled>選択してください</option>
                <option value="instagram_feed">写真フィードPR：1投稿{photoFeedPriceYen.toLocaleString("ja-JP")}円（税込）</option>
                <option value="instagram_feed_video">フィード投稿＋ショート動画：{videoPackageStartYen.toLocaleString("ja-JP")}円〜（税込）</option>
                <option value="instagram_reel">Instagramリール：お見積もり</option>
                <option value="instagram_stories">ストーリーズ：お見積もり</option>
                <option value="photo_video">写真・動画素材の撮影：お見積もり</option>
                <option value="consultation">まずは相談したい</option>
              </select>
            </label>
            <label>ご予算の目安 <em>必須</em>
              <select name="budget" defaultValue="undecided" required>
                <option value="undecided">相談して決めたい</option>
                <option value="under_10000">1万円未満</option>
                <option value="10000_30000">1万円〜3万円</option>
                <option value="30000_50000">3万円〜5万円</option>
                <option value="over_50000">5万円以上</option>
              </select>
            </label>
          </div>
          <fieldset className="diary-request-brief">
            <legend>お店のPRで伝えてほしいこと</legend>
            <label>特に伝えてほしいポイント・PRで押してほしい点 <em>必須</em>
              <textarea name="desired_coverage" rows={3} maxLength={1200} required placeholder="例：看板メニューの特徴、ランチの魅力、落ち着いた店内。実体験に基づいて発信します。" />
            </label>
            <label>紹介希望メニュー・料理・コース <span>任意</span>
              <input name="featured_menu" maxLength={500} placeholder="例：季節限定コース、新作ランチ" />
            </label>
            <label>届けたい相手・PRの目的 <span>任意</span>
              <textarea name="requested_outcome" rows={2} maxLength={500} placeholder="例：近隣の20〜30代に新メニューを知ってほしい" />
            </label>
            <label>店舗様が対応可能な日時（候補） <span>任意</span>
              <textarea name="visit_preference" rows={2} maxLength={600} placeholder="例：平日18時以降。未定でも構いません。" />
            </label>
          </fieldset>
          <label>ご希望の時期 <span>任意</span>
            <input name="desired_period" maxLength={120} placeholder="例：11月中、日程は相談" />
          </label>
        </>
      ) : (
        <>
          <input type="hidden" name="service" value="consultation" />
          <input type="hidden" name="budget" value="undecided" />
        </>
      )}
      <div className="diary-form-section-title"><span>{inquiryKind === "consultation" ? "02" : "03"}</span><h2>{inquiryKind === "consultation" ? "どんなことを相談したいですか？" : "ご相談の詳細"}</h2></div>
      <label>お店の魅力・ご相談内容 <em>必須</em>
        <textarea name="message" required minLength={10} maxLength={2000} rows={inquiryKind === "consultation" ? 4 : 5} placeholder={inquiryKind === "consultation" ? (initialGoal ? `例：${initialGoal}です。料金や制作の流れを教えてください。` : "例：新しいランチメニューをInstagramで紹介してほしいです。料金と流れを教えてください。") : "お店の特徴、紹介してほしいメニュー、ご希望の投稿イメージなどをお書きください。"} />
      </label>
      {inquiryKind === "consultation" ? (
        <details className="diary-extra-details">
          <summary>伝えたいことを詳しく書く（任意） <span aria-hidden="true">＋</span></summary>
          <div className="diary-extra-details-body">
            <label>お電話番号 <span>任意</span><input name="phone" type="tel" maxLength={30} autoComplete="tel" placeholder="例：06-1234-5678" /></label>
            <label>お店のInstagram URL <span>任意</span><input name="instagram_url" type="url" maxLength={250} placeholder="https://www.instagram.com/..." /></label>
            <label>特に伝えてほしいポイント <span>任意</span><textarea name="desired_coverage" rows={2} maxLength={1200} placeholder="例：料理の特徴や雰囲気" /></label>
            <label>紹介希望メニュー・料理・コース <span>任意</span><input name="featured_menu" maxLength={500} placeholder="例：季節の限定メニュー" /></label>
            <label>PRの目的・届けたい相手 <span>任意</span><textarea name="requested_outcome" rows={2} maxLength={500} placeholder="例：近隣の方への認知拡大" /></label>
            <label>来店候補日時 <span>任意</span><textarea name="visit_preference" rows={2} maxLength={600} placeholder="例：平日18時以降" /></label>
            <label>ご希望の時期 <span>任意</span><input name="desired_period" maxLength={120} placeholder="例：11月頃" /></label>
          </div>
        </details>
      ) : null}
      <details className="diary-compliance diary-policy-details" aria-label="お受けできない案件">
        <summary>案件受注のルールを確認する <span aria-hidden="true">＋</span></summary><strong>安心してご依頼いただくために</strong>
        <p>当アカウントでは、次のご依頼はお受けしておりません。</p>
        <ul>
          <li>食べログ・Googleマップ等への報酬や飲食提供を条件とする口コミ・評価投稿</li>
          <li>星の数や高評価、好意的なレビューを条件とする依頼</li>
          <li>広告・提供関係の非表示、事実と異なる内容の発信</li>
        </ul>
        <p>実体験に基づき、必要なPR表示をしたInstagram投稿などを制作いたします。</p>
        <Link href="/diary/policy">案件受注ポリシーを確認する ↗</Link>
      </details>
      <p className="diary-photo-privacy-note">撮影ではお食事中のお客様への配慮を徹底します。一般のお客様やスタッフの顔・声・個人情報が、必要な許可なく投稿に掲載されないよう、写り込みを確認して編集・除外します。<Link href="/diary/policy">撮影ポリシーを確認する ↗</Link></p>
      <div className="diary-honeypot" aria-hidden="true">
        <label>Webサイト <input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="diary-privacy-box">
        <label className="diary-privacy-check">
          <input type="checkbox" name="consent" required />
          <span><Link href="/legal/privacy" target="_blank" rel="noopener noreferrer">プライバシーポリシー</Link>に同意して送信します。入力した情報はPR相談への対応に利用されます。</span>
        </label>
        <label className="diary-privacy-check">
          <input type="checkbox" name="compliance_confirmed" required />
          <span><Link href="/diary/policy" target="_blank" rel="noopener noreferrer">案件受注ポリシー</Link>を確認し、口コミサイトへの投稿・高評価指定・PR表記を隠す依頼を含まないことに同意します。</span>
        </label>
        <div className="cf-turnstile" data-sitekey={siteKey} />
      </div>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      {error ? <p role="alert" aria-live="assertive" className="diary-error">{error}</p> : null}
      <button className="diary-button diary-button-primary diary-submit" type="submit" disabled={pending}>{pending ? "送信中..." : inquiryKind === "consultation" ? "無料相談を送信する" : "申込み内容を送信する"} <span>↗</span></button>
      <p className="diary-submit-foot">{inquiryKind === "consultation" ? "事前相談は無料です。": "お申し込み後、内容確認と日程提案を行います。"} 日程確認・報酬・制作範囲の合意まで契約は確定しません。支払いは投稿公開後7日以内を基本とし、合意した条件を優先します。</p>
    </form>
  );
}
