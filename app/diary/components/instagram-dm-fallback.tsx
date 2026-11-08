"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { buildDiaryDmTemplate } from "@/lib/diary/dm-template";

const INSTAGRAM_PROFILE = "https://www.instagram.com/gurunavi_diary/";

export function InstagramDmFallback({
  initialService = "",
  initialKind = "consultation",
  initialGoal = "",
}: {
  initialService?: string;
  initialKind?: "consultation" | "application";
  initialGoal?: string;
}) {
  const message = buildDiaryDmTemplate({
    service: initialService,
    inquiryKind: initialKind,
    goal: initialGoal,
  });
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [copyStatus, setCopyStatus] = useState("");

  async function copyMessage() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(message);
      setCopyStatus("コピーしました！ Instagramで「メッセージ」を選び、貼り付けて送信してください。");
    } catch {
      textRef.current?.focus();
      textRef.current?.select();
      setCopyStatus("自動コピーできませんでした。選択した文章を手動でコピーしてください。");
    }
  }

  return (
    <section className="diary-v2-dm-fallback" aria-labelledby="diary-dm-title">
      <span className="diary-v2-section-label">INSTAGRAM DM / FREE CONSULTATION</span>
      <h2 id="diary-dm-title">PRのご相談は、<br /><em>InstagramのDMから。</em></h2>
      <p className="diary-dm-lead">Webフォームは現在準備中ですが、Instagramから直接ご相談いただけます。まずは店舗名と紹介したい料理だけでも大丈夫です。</p>
      <ol className="diary-dm-steps">
        <li><strong>01</strong><span>下の相談文をコピー</span></li>
        <li><strong>02</strong><span>Instagramで「メッセージ」を開く</span></li>
        <li><strong>03</strong><span>内容を編集してDMを送信</span></li>
      </ol>
      <label className="diary-dm-template-label" htmlFor="diary-dm-template">そのまま使える相談文（コピー前に内容をご確認ください）</label>
      <textarea
        id="diary-dm-template"
        ref={textRef}
        className="diary-dm-template"
        value={message}
        readOnly
        rows={12}
        aria-describedby="diary-dm-privacy"
      />
      <div className="diary-dm-actions">
        <button className="diary-v2-dm-copy" type="button" onClick={() => { void copyMessage(); }}>
          相談文をコピーする <span aria-hidden="true">⧉</span>
        </button>
        <a className="diary-v2-button diary-v2-button-accent" href={INSTAGRAM_PROFILE} target="_blank" rel="noopener noreferrer">
          Instagramを開く <span aria-hidden="true">↗</span>
        </a>
      </div>
      <p className="diary-dm-copy-status" role="status" aria-live="polite">{copyStatus}</p>
      <p id="diary-dm-privacy" className="diary-dm-privacy">この画面で入力・コピーした内容は当サイトのサーバーに送信されません。Instagramでの送信操作はご自身で行ってください。DMで相談するだけでは契約は成立しません。<Link href="/diary/policy">PR制作方針 ↗</Link></p>
    </section>
  );
}
