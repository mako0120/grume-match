import Link from "next/link";
import { requestPasswordReset } from "@/server/actions/auth";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <span className="eyebrow">GOURMET DIARY</span>
        <h1>パスワード再設定</h1>
        <p className="auth-lead">
          登録メールアドレスへ再設定リンクを送信します。
        </p>

        {message ? <div className="form-message">{message}</div> : null}

        <form action={requestPasswordReset} className="form-stack">
          <label>
            メールアドレス
            <input autoComplete="email" name="email" required type="email" />
          </label>
          <button className="primary-button form-submit" type="submit">
            再設定メールを送る
          </button>
        </form>

        <p className="auth-switch">
          <Link href="/login">ログインへ戻る</Link>
        </p>
      </section>
    </main>
  );
}
