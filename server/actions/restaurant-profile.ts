"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function saveRestaurantProfile(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const area = String(formData.get("area") ?? "").trim();

  if (!name || !address || !area) {
    redirect(
      "/restaurant/settings?status=error&message=" +
        encodeURIComponent("店舗名・住所・エリアを入力してください。"),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_restaurant_profile", {
    p_name: name,
    p_address: address,
    p_area: area,
  });

  if (error) {
    redirect(
      "/restaurant/settings?status=error&message=" +
        encodeURIComponent("店舗情報を保存できませんでした。"),
    );
  }

  revalidatePath("/restaurant");
  revalidatePath("/restaurant/settings");
  redirect(
    "/restaurant/settings?status=ok&message=" +
      encodeURIComponent(
        "店舗情報を保存しました。店舗名または住所を変更した場合は運営確認が再度必要です。",
      ),
  );
}
