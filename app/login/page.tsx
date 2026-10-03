import Link from "next/link";
import { safeReturnTo } from "@/lib/return-to";
import { signIn } from "@/server/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; next?: string }>;
}) {
  const { message, next: nextParam } = await searchParams;
  const next = safeReturnTo(nextParam);

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <span className="eyebrow">GOURMET DIARY</span>
        <h1>ログイン</h1>
        <p className="auth-lead">Creator・店舗どちらも同じアカウントから始められます。</p>

        {message ? <div className="form-message">{message}</div> : null}

        <form action={signIn} className="form-stack">
          {next ? <input name="next" type="hidden" value={next} /> : null}
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
          初めてですか？ <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}>アカウントを作成</Link>
        </p>
      </section>
    </main>
  );
}
