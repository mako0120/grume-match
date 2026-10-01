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
    throw new Error("支払い状態を更新できませんでした。");
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  revalidatePath("/creator/wallet");
  revalidatePath("/creator/bookings");
}
