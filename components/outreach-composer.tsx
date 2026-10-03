"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buildOutreachEmail, gmailComposeUrl, isEmail } from "@/lib/outreach";
import { logOutreach } from "@/server/actions/performance";

export function OutreachComposer({
  creatorName,
  highlights,
  orderUrl,
  price,
  verified,
}: {
  creatorName: string;
  highlights: string[];
  orderUrl: string;
  price: number;
  verified: boolean;
}) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const email_ = email.trim();
  const draft = buildOutreachEmail({
    creatorName,
    companyName: companyName.trim() || "（店名）",
    contactName: contactName.trim() || undefined,
    price,
    orderUrl,
    highlights,
    verified,
  });

  function open() {
    setError("");
    if (!companyName.trim()) return setError("店名・会社名を入力してください。");
    if (email_ && !isEmail(email_)) return setError("メールアドレスを確認してください。");

    // Open synchronously inside the click so pop-up blockers allow it.
    window.open(gmailComposeUrl(email_, draft.subject, draft.body), "_blank", "noopener");

    void logOutreach({ companyName, contactName, email: email_ }).then(() => {
      setCompanyName("");
      setContactName("");
      setEmail("");
      router.refresh();
    });
  }

  return (
    <div className="campaign-form outreach-form">
      <label>
        店名・会社名
        <input
          maxLength={80}
          onChange={(event) => setCompanyName(event.target.value)}
          placeholder="焼肉 ひまわり"
          value={companyName}
        />
      </label>
      <div className="field-row">
        <label>
          担当者名（任意）
          <input
            maxLength={40}
            onChange={(event) => setContactName(event.target.value)}
            placeholder="山田"
            value={contactName}
          />
        </label>
        <label>
          メールアドレス（任意）
          <input
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="info@example.com"
            type="email"
            value={email}
          />
        </label>
      </div>

      <details className="outreach-preview">
        <summary>送る文面を確認</summary>
        <p className="outreach-subject">{draft.subject}</p>
        <pre>{draft.body}</pre>
      </details>

      {error ? <div className="form-message error-message">{error}</div> : null}

      <button className="primary-button" onClick={open} type="button">
        Gmailで作成する
      </button>
      <p className="field-help">
        Gmailの作成画面が開きます。内容を確認して送信してください（アプリからは自動送信しません）。
      </p>
    </div>
  );
}
