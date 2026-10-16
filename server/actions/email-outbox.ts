"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function retryNotificationEmail(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_retry_notification_email", {
    p_outbox_id: id,
  });

  if (error) {
    const message = (error.message ?? "").includes("email_already_sent")
      ? "このメールはすでに送信済みです。"
      : "再送待ちに戻せませんでした。";

    redirect(
      "/admin/email?status=error&message=" + encodeURIComponent(message),
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/email");
  redirect(
    "/admin/email?status=ok&message=" +
      encodeURIComponent("メールを再送待ちに戻しました。"),
  );
}
