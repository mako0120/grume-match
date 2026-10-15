"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const allowed = new Set(["scheduled", "paid", "failed"]);

export async function updatePaymentStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !allowed.has(status)) return;

  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_update_payment_status", {
    p_payment_id: id,
    p_status: status,
  });

  if (error) {
    const reason = error.message ?? "";

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
