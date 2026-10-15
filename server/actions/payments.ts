"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const allowed = new Set(["scheduled", "paid", "failed"]);

export async function updatePaymentStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const transferReference = String(formData.get("transferReference") ?? "").trim();
  const transferNote = String(formData.get("transferNote") ?? "").trim();

  if (!id || !allowed.has(status)) return;

  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_record_payment_status", {
    p_payment_id: id,
    p_status: status,
    p_transfer_reference: transferReference || null,
    p_transfer_note: transferNote || null,
  });

  if (error) {
    const reason = error.message ?? "";

    if (reason.includes("transfer_reference_required")) {
      throw new Error("支払済みにする場合は振込参照番号を入力してください。");
    }
    if (reason.includes("creator_payout_profile_required")) {
      throw new Error("Creatorの振込先が未登録です。");
    }
    if (reason.includes("payment_blocked_by_open_dispute")) {
      throw new Error("この案件は運営確認中のため、支払いを進められません。");
    }

    throw new Error("支払い状態を更新できませんでした。");
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  revalidatePath("/creator/wallet");
  revalidatePath("/creator/bookings");
}
