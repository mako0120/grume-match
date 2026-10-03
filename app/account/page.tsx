import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/server/actions/auth";

const roleLabels: Record<string, string> = {
  creator: "Creator",
  restaurant: "店舗",
  admin: "運営",
};

export default async function AccountPage() {
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
            <Link className="secondary-button" href="/creator/performance">
              過去30日の実績・メディアキット
            </Link>
          </>
        ) : null}

        <Link className="secondary-button" href="/notifications">
          通知を見る
        </Link>

        <form action={signOut}>
          <button className="secondary-button account-signout" type="submit">
            ログアウト
          </button>
        </form>
      </section>
    </main>
  );
}
