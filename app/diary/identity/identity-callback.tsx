"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { acceptInvite, handleAuthCallback, updateUser } from "@netlify/identity";

type Flow = "idle" | "processing" | "invite" | "recovery" | "complete" | "failed";
const HASH = /^#(?:invite_token|recovery_token|confirmation_token|email_change_token|access_token)=/;

/**
 * Netlify Identity sends invite / recovery links to the site's configured root.
 * Process their URL fragments before exposing the regular landing page.
 * Never log or put invitation/recovery tokens in a query string or server log.
 */
export function DiaryIdentityCallback({ children }: { children: ReactNode }) {
  const [flow, setFlow] = useState<Flow>("idle");
  const [invite, setInvite] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const callbackStarted = useRef(false);

  useEffect(() => {
    if (callbackStarted.current || !HASH.test(window.location.hash)) return;
    callbackStarted.current = true;
    // Defer state updates out of the synchronous effect phase, and only
    // exchange an invite/recovery token once under React StrictMode.
    void Promise.resolve().then(async () => {
      setFlow("processing");
      return handleAuthCallback();
    }).then(result => {
      if (!result) { setFlow("failed"); return; }
      if (result.type === "invite") {
        if (typeof result.token !== "string" || !result.token) { setFlow("failed"); return; }
        setInvite(result.token);
        setFlow("invite");
      } else if (result.type === "recovery") {
        setFlow("recovery");
      } else {
        // Confirmations and provider callbacks are already processed.
        setFlow("complete");
      }
    }).catch(() => { setFlow("failed"); });
  }, []);

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !["invite", "recovery"].includes(flow)) return;
    if (password.length < 12 || password !== confirm) {
      setError("12文字以上のパスワードを入力し、確認欄と一致させてください。");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      if (flow === "invite") {
        if (!invite) throw Error("invite_token_missing");
        await acceptInvite(invite, password);
        // Never persist invite tokens after a successful acceptance.
        setInvite(null);
      } else {
        await updateUser({ password });
      }
      setPassword("");
      setConfirm("");
      window.location.replace("/diary/ops");
    } catch {
      setError("設定に失敗しました。リンクの有効期限を確認し、必要なら管理者に再招待を依頼してください。");
    } finally {
      setSubmitting(false);
    }
  }

  if (flow === "idle") return <>{children}</>;

  return <div className="diary-identity-overlay" role="main">
    <section className="diary-identity-panel" aria-label="グルメ日誌・管理者アカウント認証">
      <span className="diary-identity-eyebrow">GOURMET DIARY / SECURE ACCESS</span>
      {flow === "processing" && <>
        <h1>アカウントを確認しています</h1>
        <p role="status">Netlify Identityの招待・認証リンクを検証しています。</p>
      </>}
      {(flow === "invite" || flow === "recovery") && <>
        <h1>{flow === "invite" ? "管理者アカウントの初期設定" : "パスワードの再設定"}</h1>
        <p>12文字以上の新しいパスワードを設定してください。招待リンクやパスワードを他の人に共有しないでください。</p>
        <form onSubmit={(event) => { void savePassword(event); }}>
          <label>新しいパスワード
            <input type="password" autoComplete="new-password" required minLength={12}
              value={password} onChange={e => setPassword(e.target.value)} />
          </label>
          <label>新しいパスワード（確認）
            <input type="password" autoComplete="new-password" required minLength={12}
              value={confirm} onChange={e => setConfirm(e.target.value)} />
          </label>
          {error && <p role="alert" className="diary-identity-error">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? "設定中…" : flow === "invite" ? "招待を承諾して登録する" : "パスワードを変更する"}
          </button>
        </form>
      </>}
      {flow === "complete" && <>
        <h1>アカウント確認が完了しました</h1>
        <p>案件管理画面で管理者としてログインしてください。</p>
        <a href="/diary/ops">案件管理画面を開く</a>
      </>}
      {flow === "failed" && <>
        <h1>認証リンクを確認できませんでした</h1>
        <p role="alert">リンクが期限切れか、既に使用された可能性があります。管理者に再招待を依頼してください。</p>
        <a href="/diary/ops">管理者ログインに戻る</a>
      </>}
    </section>
  </div>;
}
