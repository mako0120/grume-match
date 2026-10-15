"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function reviewNoShow(formData: FormData) {
  const bookingId = String(formData.get("bookingId") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!bookingId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_booking_no_show", {
    p_booking_id: bookingId,
    p_note: note || null,
  });

  if (error) {
    redirect(
      "/admin/no-shows?status=error&message=" +
        encodeURIComponent("来店例外を確認済みにできませんでした。"),
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/no-shows");
  redirect(
    "/admin/no-shows?status=ok&message=" +
      encodeURIComponent("来店例外を確認済みにしました。"),
  );
}
