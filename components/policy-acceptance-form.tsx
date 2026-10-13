"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CURRENT_POLICY_VERSION, REQUIRED_POLICIES } from "@/lib/policies";
import { createClient } from "@/lib/supabase/client";

export function PolicyAcceptanceForm() {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (!confirmed || pending) return;

    setPending(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.replace("/login");
        return;
      }

      const rows = REQUIRED_POLICIES.map((policy) => ({
        user_id: data.user.id,
        policy,
        version: CURRENT_POLICY_VERSION,
      }));

      const { error } = await supabase
        .from("user_policy_acceptances")
        .upsert(rows, {
          onConflict: "user_id,policy,version",
          ignoreDuplicates: true,
        });

      if (error) {
        setMessage("同意内容を保存できませんでした。もう一度お試しください。");
        return;
      }

      router.replace("/onboarding");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="policy-acceptance-form">
      <label className="policy-confirm-row">
        <input
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          type="checkbox"
        />
        <span>
          <Link href="/legal/terms" target="_blank">利用規約</Link>、
          <Link href="/legal/privacy" target="_blank">プライバシーポリシー</Link>、
          <Link href="/legal/pr-guidelines" target="_blank">PRガイドライン</Link>
          を確認し、同意します。
        </span>
      </label>

      {message ? <div className="form-message error-message">{message}</div> : null}

      <button
        className="primary-button form-submit"
        disabled={!confirmed || pending}
        onClick={submit}
        type="button"
      >
        {pending ? "保存中..." : "同意して続ける"}
      </button>
    </div>
  );
}
