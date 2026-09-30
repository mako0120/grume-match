"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const allowed = new Set(["scheduled", "paid", "failed"]);

export async function updatePaymentStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !allowed.has(status)) return;

  const supabase = await createClient();
  const patch =
    status === "paid"
      ? { status, paid_at: new Date().toISOString() }
      : { status, paid_at: null };

  await supabase.from("payments").update(patch).eq("id", id);

  revalidatePath("/admin/payments");
  revalidatePath("/admin");
}
