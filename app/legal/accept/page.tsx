import { redirect } from "next/navigation";
import { PolicyAcceptanceForm } from "@/components/policy-acceptance-form";
import { createClient } from "@/lib/supabase/server";

export default async function PolicyAcceptancePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/login");

  return (
    <main className="auth-shell">
      <section className="auth-card legal-accept-card">
        <span className="eyebrow">GOURMET DIARY</span>
        <h1>利用前の確認</h1>
        <p className="auth-lead">
          Creatorと店舗の双方が安心して有償PRを進められるよう、3つの方針をご確認ください。
        </p>

        <div className="legal-summary-list">
          <div>
            <strong>利用規約</strong>
            <p>案件・投稿・支払い・キャンセルなどの基本ルールです。</p>
          </div>
          <div>
            <strong>プライバシーポリシー</strong>
            <p>登録情報やサービス利用データの取り扱い方針です。</p>
          </div>
          <div>
            <strong>PRガイドライン</strong>
            <p>広告であることを明示し、誤解を招く投稿を避けるためのルールです。</p>
          </div>
        </div>

        <PolicyAcceptanceForm />
      </section>
    </main>
  );
}
