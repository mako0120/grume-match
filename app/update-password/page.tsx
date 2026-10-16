import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updatePassword } from "@/server/actions/auth";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/forgot-password");

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <span className="eyebrow">GOURMET DIARY</span>
        <h1>新しいパスワード</h1>
        <p className="auth-lead">8文字以上の新しいパスワードを設定してください。</p>

        {message ? <div className="form-message">{message}</div> : null}

        <form action={updatePassword} className="form-stack">
          <label>
            新しいパスワード
            <input autoComplete="new-password" minLength={8} name="password" required type="password" />
          </label>
          <label>
            新しいパスワード（確認）
            <input autoComplete="new-password" minLength={8} name="confirmation" required type="password" />
          </label>
          <button className="primary-button form-submit" type="submit">
            パスワードを更新
          </button>
        </form>
      </section>
    </main>
  );
}
