import Link from "next/link";
import { signIn } from "@/server/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <span className="eyebrow">GOURMET DIARY</span>
        <h1>ログイン</h1>
        <p className="auth-lead">Creator・店舗どちらも同じアカウントから始められます。</p>

        {message ? <div className="form-message">{message}</div> : null}

        <form action={signIn} className="form-stack">
          <label>
            メールアドレス
            <input autoComplete="email" name="email" required type="email" />
          </label>
          <label>
            パスワード
            <input autoComplete="current-password" minLength={8} name="password" required type="password" />
          </label>
          <button className="primary-button form-submit" type="submit">ログイン</button>
        </form>

        <p className="auth-switch">
          初めてですか？ <Link href="/signup">アカウントを作成</Link>
        </p>
      </section>
    </main>
  );
}
