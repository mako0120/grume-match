import Link from "next/link";
import { safeReturnTo } from "@/lib/return-to";
import { signUp } from "@/server/actions/auth";

export default async function SignupPage({
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
        <h1>アカウント作成</h1>
        <p className="auth-lead">まず共通アカウントを作り、その後Creatorか店舗を選びます。</p>

        {message ? <div className="form-message">{message}</div> : null}

        <form action={signUp} className="form-stack">
          {next ? <input name="next" type="hidden" value={next} /> : null}
          <label>
            メールアドレス
            <input autoComplete="email" name="email" required type="email" />
          </label>
          <label>
            パスワード
            <input autoComplete="new-password" minLength={8} name="password" required type="password" />
          </label>
          <button className="primary-button form-submit" type="submit">登録する</button>
        </form>

        <p className="auth-switch">
          すでに登録済みですか？ <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>ログイン</Link>
        </p>
      </section>
    </main>
  );
}
