import Link from "next/link";

export default function SupportPage() {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ?? "";
  const operatorName = process.env.NEXT_PUBLIC_OPERATOR_NAME?.trim() ?? "";

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <span className="eyebrow">SUPPORT</span>
        <h1>お問い合わせ</h1>
        <p className="auth-lead">
          案件・来店・投稿・報酬・アカウントについて確認が必要な場合の窓口です。
        </p>

        <section className="section-card">
          <strong>{operatorName || "GOURMET DIARY 運営"}</strong>
          {supportEmail ? (
            <a className="secondary-button" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </a>
          ) : (
            <div className="form-message error-message">
              サポート窓口は現在準備中です。
            </div>
          )}
        </section>

        <p className="auth-lead">
          進行中のPR案件に関するトラブルは、まず案件詳細の「運営に確認を依頼する」をご利用ください。
        </p>

        <Link className="secondary-button" href="/login">
          ログイン画面へ
        </Link>
      </section>
    </main>
  );
}
