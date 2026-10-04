"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const PAGE = "/restaurant/billing";

export async function saveBillingEmail(formData: FormData) {
  const restaurantId = String(formData.get("restaurantId") ?? "");
  const email = String(formData.get("billingEmail") ?? "").trim();
  if (!restaurantId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_restaurant_billing_email", {
    p_restaurant_id: restaurantId,
    p_email: email,
  });

  const message = error
    ? error.message.includes("invalid_billing_email")
      ? "メールアドレスを確認してください。"
      : "保存できませんでした。"
    : "請求書の送付先を保存しました。";

  revalidatePath(PAGE);
  redirect(PAGE + "?message=" + encodeURIComponent(message));
}
