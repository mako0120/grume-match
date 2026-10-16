"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function messagePath(message: string, status: "ok" | "error") {
  return "/creator/payout?status=" + status + "&message=" + encodeURIComponent(message);
}

export async function saveCreatorPayoutProfile(formData: FormData) {
  const bankName = String(formData.get("bankName") ?? "").trim();
  const branchName = String(formData.get("branchName") ?? "").trim();
  const accountType = String(formData.get("accountType") ?? "");
  const accountNumber = String(formData.get("accountNumber") ?? "").replace(/s+/g, "");
  const accountHolder = String(formData.get("accountHolder") ?? "").trim();

  if (!bankName || !branchName || !accountNumber || !accountHolder) {
    redirect(messagePath("振込先をすべて入力してください。", "error"));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_creator_payout_profile", {
    p_bank_name: bankName,
    p_branch_name: branchName,
    p_account_type: accountType,
    p_account_number: accountNumber,
    p_account_holder: accountHolder,
  });

  if (error) {
    const reason = error.message ?? "";
    const message = reason.includes("invalid_account_number")
      ? "口座番号は半角数字4〜8桁で入力してください。"
      : reason.includes("invalid_account_type")
        ? "口座種別を確認してください。"
        : reason.includes("payout_profile_locked_by_active_payment")
          ? "支払い処理中の報酬があるため、現在は振込先を変更できません。振込エラー時は運営確認後に変更できます。"
          : "振込先を保存できませんでした.";

    redirect(messagePath(message, "error"));
  }

  revalidatePath("/creator/payout");
  revalidatePath("/creator/wallet");
  revalidatePath("/admin/payments");
  redirect(messagePath("振込先を保存しました。", "ok"));
}
