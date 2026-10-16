import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { saveCreatorPayoutProfile } from "@/server/actions/payout-profile";

export default async function CreatorPayoutPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; status?: string }>;
}) {
  const { message, status } = await searchParams;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("creator_profiles")
    .select("id")
    .eq("user_id", authData.user!.id)
    .single();

  const { data: payout } = profile
    ? await supabase
        .from("creator_payout_profiles")
        .select("bank_name,branch_name,account_type,account_number,account_holder,updated_at")
        .eq("creator_id", profile.id)
        .maybeSingle()
    : { data: null };

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <Link className="header-action" href="/creator/wallet">
          報酬へ戻る
        </Link>
      </header>

      <span className="eyebrow">PAYOUT</span>
      <h1 className="page-title">振込先</h1>
      <p className="page-subtitle">
        報酬の振込に必要な情報です。店舗には表示されません。
      </p>

      {message ? (
        <div
          aria-live="polite"
          className={status === "error" ? "form-message error-message" : "form-message inline-success"}
        >
          {message}
        </div>
      ) : null}

      <form action={saveCreatorPayoutProfile} className="campaign-form">
        <section className="form-section">
          <span className="eyebrow">BANK ACCOUNT</span>
          <h2>銀行口座</h2>

          <div className="field-row">
            <label>
              銀行名
              <input
                defaultValue={payout?.bank_name ?? ""}
                name="bankName"
                placeholder="三井住友銀行"
                required
              />
            </label>
            <label>
              支店名
              <input
                defaultValue={payout?.branch_name ?? ""}
                name="branchName"
                placeholder="梅田支店"
                required
              />
            </label>
          </div>

          <div className="field-row">
            <label>
              口座種別
              <select defaultValue={payout?.account_type ?? "ordinary"} name="accountType">
                <option value="ordinary">普通</option>
                <option value="current">当座</option>
              </select>
            </label>
            <label>
              口座番号
              <input
                autoComplete="off"
                defaultValue={payout?.account_number ?? ""}
                inputMode="numeric"
                name="accountNumber"
                pattern="[0-9]{4,8}"
                required
              />
            </label>
          </div>

          <label>
            口座名義
            <input
              autoComplete="off"
              defaultValue={payout?.account_holder ?? ""}
              name="accountHolder"
              placeholder="コバヤシ リュウセイ"
              required
            />
          </label>

          <div className="pending-box">
            振込先はCreator本人と運営のみ確認できます。監査ログには口座番号の下4桁だけを残します。
          </div>

          <button className="primary-button publish-button" type="submit">
            振込先を保存
          </button>
        </section>
      </form>
    </main>
  );
}
