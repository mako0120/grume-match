import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requestAccountClosure } from "@/server/actions/account-closure";
import { signOut } from "@/server/actions/auth";

const roleLabels: Record<string, string> = {
  creator: "Creator",
  restaurant: "店舗",
  admin: "運営",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; status?: string }>;
}) {
  const { message, status } = await searchParams;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) redirect("/login");

  const { data: userRow } = await supabase
    .from("users")
    .select("role,status,onboarding_completed_at")
    .eq("id", authData.user.id)
    .single();

  if (!userRow || userRow.status !== "active") {
    redirect("/login");
  }

  const { data: closureRequest } =
    userRow.role === "admin"
      ? { data: null }
      : await supabase
          .from("account_closure_requests")
          .select("id,status,created_at,reason")
          .eq("user_id", authData.user.id)
          .eq("status", "pending")
          .maybeSingle();

  const homeHref =
    userRow.role === "admin"
      ? "/admin"
      : userRow.role === "restaurant"
        ? "/restaurant"
        : "/creator/campaigns";

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <Link className="header-action" href={homeHref}>
          戻る
        </Link>
      </header>

      <span className="eyebrow">ACCOUNT</span>
      <h1 className="page-title">アカウント</h1>
      <p className="page-subtitle">
        ログイン情報と、必要な設定だけをまとめています。
      </p>

      {message ? (
        <div
          aria-live="polite"
          className={status === "error" ? "form-message error-message" : "form-message inline-success"}
        >
          {message}
        </div>
      ) : null}

      <section className="section-card account-card">
        <div>
          <span>メールアドレス</span>
          <strong>{authData.user.email ?? "未設定"}</strong>
        </div>
        <div>
          <span>利用タイプ</span>
          <strong>{roleLabels[userRow.role] ?? userRow.role}</strong>
        </div>
      </section>

      <section className="account-actions">
        {!userRow.onboarding_completed_at ? (
          <Link className="secondary-button" href="/onboarding">
            初期設定を続ける
          </Link>
        ) : null}

        {userRow.role === "creator" ? (
          <>
            <Link className="secondary-button" href="/creator/profile">
              Creatorプロフィールを編集
            </Link>
            <Link className="secondary-button" href="/creator/payout">
              振込先を設定
            </Link>
          </>
        ) : null}

        {userRow.role === "restaurant" ? (
          <Link className="secondary-button" href="/restaurant/settings">
            店舗情報を編集
          </Link>
        ) : null}

        <Link className="secondary-button" href="/legal/terms">
          利用規約
        </Link>
        <Link className="secondary-button" href="/legal/privacy">
          プライバシーポリシー
        </Link>
        <Link className="secondary-button" href="/legal/pr-guidelines">
          PRガイドライン
        </Link>
        <Link className="secondary-button" href="/legal/operator">
          運営者情報
        </Link>
        <Link className="secondary-button" href="/support">
          お問い合わせ
        </Link>

        <Link className="secondary-button" href="/notifications">
          通知を見る
        </Link>

        {userRow.role !== "admin" ? (
          closureRequest ? (
            <section className="section-card">
              <span className="meta-pill">受付済み</span>
              <strong>アカウント停止の依頼を確認中です</strong>
              <p>運営が未完了案件や必要な記録を確認してから対応します。</p>
            </section>
          ) : (
            <details className="section-card">
              <summary>アカウント停止・削除について相談</summary>
              <form action={requestAccountClosure} className="form-stack">
                <label>
                  理由・希望（任意）
                  <textarea
                    name="reason"
                    placeholder="停止希望、個人情報の削除相談など"
                    rows={3}
                  />
                </label>
                <div className="pending-box">
                  取引記録や法令・会計上必要な情報は、確認なしに即時削除しません。
                </div>
                <button className="secondary-button" type="submit">
                  運営へ依頼する
                </button>
              </form>
            </details>
          )
        ) : null}

        <form action={signOut}>
          <button className="secondary-button account-signout" type="submit">
            ログアウト
          </button>
        </form>
      </section>
    </main>
  );
}
