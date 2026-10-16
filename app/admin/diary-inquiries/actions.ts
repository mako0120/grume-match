"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";

const statuses = ["new", "contacted", "proposed", "booked", "closed"] as const;

export async function updateDiaryInquiryStatus(form: FormData) {
  // Recheck permissions for the action itself; the admin layout is not an auth boundary for actions.
  await requireRole(["admin"]);
  const id = form.get("id");
  const status = form.get("status");
  if (typeof id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
      typeof status !== "string" ||
      !statuses.some((value) => value === status)) {
    throw new Error("Invalid inquiry update");
  }
  const admin = createAdminClient();
  const { error } = await admin.from("diary_pr_inquiries").update({ status }).eq("id", id);
  if (error) throw new Error("Inquiry update failed");
  revalidatePath("/admin/diary-inquiries");
}
