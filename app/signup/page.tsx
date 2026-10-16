import Link from "next/link";
import { signUp } from "@/server/actions/auth";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const privateAlpha = process.env.PUBLIC_LAUNCH_ENABLED !== "true";

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <span className="eyebrow">GOURMET DIARY</span>
        <h1>アカウント作成</h1>
        <p className="auth-lead">まず共通アカウントを作り、その後Creatorか店舗を選びます。</p>

        {message ? <div className="form-message">{message}</div> : null}

        <form action={signUp} className="form-stack">
          <label>
            メールアドレス
            <input autoComplete="email" name="email" required type="email" />
          </label>
          <label>
            パスワード
            <input autoComplete="new-password" minLength={8} name="password" required type="password" />
          </label>

          {privateAlpha ? (
            <label>
              Private Alpha 招待コード
              <input
                autoComplete="off"
                name="alphaAccessCode"
                required
                type="password"
              />
            </label>
          ) : null}
          {privateAlpha ? (
            <label>
              Private Alpha 招待コード
              <input
                autoComplete="off"
                name="privateAlphaAccessCode"
                required
                type="password"
              />
            </label>
          ) : null}
          <label className="policy-confirm-row">
            <input name="policyConsent" required type="checkbox" />
            <span>
              <Link href="/legal/terms" target="_blank">利用規約</Link>、
              <Link href="/legal/privacy" target="_blank">プライバシーポリシー</Link>、
              <Link href="/legal/pr-guidelines" target="_blank">PRガイドライン</Link>
              を確認しました。
            </span>
          </label>
          <button className="primary-button form-submit" type="submit">登録する</button>
        </form>

        <p className="auth-switch">
          すでに登録済みですか？ <Link href="/login">ログイン</Link>
        </p>
      </section>
    </main>
  );
}
