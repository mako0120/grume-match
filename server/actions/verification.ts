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
