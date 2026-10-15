"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function verifyParticipant(formData: FormData) {
  const kind = String(formData.get("kind") ?? "");
  const id = String(formData.get("id") ?? "");

  if (!id || !["creator", "restaurant"].includes(kind)) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_verify_participant", {
    p_kind: kind,
    p_id: id,
  });

  if (error) {
    redirect(
      "/admin/verification?status=error&message=" +
        encodeURIComponent("確認済みにできませんでした。"),
    );
  }

  revalidatePath("/admin/verification");
  revalidatePath("/admin");
  revalidatePath("/creator/profile");
  revalidatePath("/restaurant");

  redirect(
    "/admin/verification?status=ok&message=" +
      encodeURIComponent(
        kind === "creator"
          ? "Creatorを確認済みにしました。"
          : "店舗を確認済みにしました。",
      ),
  );
}


export async function suspendParticipant(formData: FormData) {
  const kind = String(formData.get("kind") ?? "");
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!id || !["creator", "restaurant"].includes(kind) || !reason) {
    redirect(
      "/admin/verification?status=error&message=" +
        encodeURIComponent("利用停止の理由を入力してください。"),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_suspend_participant", {
    p_kind: kind,
    p_id: id,
    p_reason: reason,
  });

  if (error) {
    const code = error.message ?? "";
    const message = code.includes("participant_has_active_transactions")
      ? "進行中の案件や未処理の報酬があるため、先に取引を完了してください。"
      : "利用停止にできませんでした。";

    redirect(
      "/admin/verification?status=error&message=" +
        encodeURIComponent(message),
    );
  }

  revalidatePath("/admin/verification");
  revalidatePath("/admin");
  revalidatePath("/creator/campaigns");
  revalidatePath("/restaurant");

  redirect(
    "/admin/verification?status=ok&message=" +
      encodeURIComponent("利用停止にしました。"),
  );
}
