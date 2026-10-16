"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const allowed = new Set(["scheduled", "paid", "failed"]);

function resultPath(message: string, status: "ok" | "error") {
  return (
    "/admin/payments?status=" +
    status +
    "&message=" +
    encodeURIComponent(message)
  );
}

export async function updatePaymentStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const transferReference = String(
    formData.get("transferReference") ?? "",
  ).trim();
  const transferNote = String(formData.get("transferNote") ?? "").trim();

  if (!id || !allowed.has(status)) {
    redirect(resultPath("支払い操作を確認できませんでした。", "error"));
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_record_payment_status", {
    p_payment_id: id,
    p_status: status,
    p_transfer_reference: transferReference || null,
    p_transfer_note: transferNote || null,
  });

  if (error) {
    const reason = error.message ?? "";
    let message = "支払い状態を更新できませんでした。";

    if (reason.includes("transfer_reference_required")) {
      message = "支払済みにする場合は振込参照番号を入力してください。";
    } else if (reason.includes("creator_payout_profile_required")) {
      message = "Creatorの振込先が未登録です。";
    } else if (reason.includes("payment_blocked_by_open_dispute")) {
      message = "この案件は運営確認中のため、支払いを進められません。";
    } else if (reason.includes("paid_payment_immutable")) {
      message = "支払済みの記録は変更できません。";
    } else if (reason.includes("invalid_payment_transition")) {
      message = "現在の支払い状態からその操作には変更できません。";
    }

    redirect(resultPath(message, "error"));
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  revalidatePath("/creator/wallet");
  revalidatePath("/creator/bookings");

  const message =
    status === "paid"
      ? "振込済みとして確定し、証跡を保存しました。"
      : status === "scheduled"
        ? "振込予定として保存しました。"
        : "振込エラーとして記録しました。";

  redirect(resultPath(message, "ok"));
}
