"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestAccountClosure(formData: FormData) {
  const reason = String(formData.get("reason") ?? "").trim();
  const supabase = await createClient();

  const { error } = await supabase.rpc("request_account_closure", {
    p_reason: reason || null,
  });

  if (error) {
    const code = error.message ?? "";
    const message = code.includes("closure_request_already_pending")
      ? "アカウント停止の依頼はすでに受付済みです。"
      : "アカウント停止の依頼を送信できませんでした。";

    redirect(
      "/account?status=error&message=" + encodeURIComponent(message),
    );
  }

  revalidatePath("/account");
  revalidatePath("/admin");
  revalidatePath("/admin/accounts");
  redirect(
    "/account?status=ok&message=" +
      encodeURIComponent("アカウント停止の依頼を受け付けました。運営が確認します。"),
  );
}

export async function reviewAccountClosure(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");
  const action = String(formData.get("action") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!requestId || !["suspend", "dismiss"].includes(action)) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_account_closure", {
    p_request_id: requestId,
    p_action: action,
    p_note: note || null,
  });

  if (error) {
    const reason = error.message ?? "";
    const message = reason.includes("closure_has_active_transactions")
      ? "未完了の案件・来店・報酬があるため、まだアカウントを停止できません。"
      : reason.includes("closure_request_already_resolved")
        ? "この依頼はすでに処理済みです。"
        : "アカウント依頼を処理できませんでした。";

    redirect(
      "/admin/accounts?status=error&message=" +
        encodeURIComponent(message),
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/accounts");
  redirect(
    "/admin/accounts?status=ok&message=" +
      encodeURIComponent(
        action === "suspend"
          ? "アカウントを停止しました。"
          : "依頼を対応不要として閉じました。",
      ),
  );
}
