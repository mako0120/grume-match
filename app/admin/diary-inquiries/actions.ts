"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";

const statuses = ["new", "contacted", "proposed", "booked", "closed"] as const;

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every inbound inquiry starts pending. A human operator checks the
 * campaign deliverables and ad disclosure BEFORE proposing a deal.
 * A declined inquiry is closed instead of being sent to the marketplace.
 */
export async function reviewDiaryInquiryCompliance(form: FormData) {
  await requireRole(["admin"]);
  const id = form.get("id");
  const decision = form.get("decision");
  if (typeof id !== "string" || !idPattern.test(id) ||
      (decision !== "approved" && decision !== "rejected") ||
      form.get("review_confirmed") !== "on") {
    throw new Error("Review checklist confirmation required");
  }

  const admin = createAdminClient();
  const update: Record<string, string> = {
    compliance_status: decision,
    compliance_reviewed_at: new Date().toISOString(),
  };
  if (decision === "rejected") update.status = "closed";
  const { data, error } = await admin.from("diary_pr_inquiries")
    .update(update)
    .eq("id", id)
    .in("status", ["new", "contacted"])
    .select("id")
    .maybeSingle();
  if (error || !data) throw new Error("Review failed or inquiry already progressed");
  revalidatePath("/admin/diary-inquiries");
}


export async function updateDiaryInquiryStatus(form: FormData) {
  // Recheck permissions for the action itself; the admin layout is not an auth boundary for actions.
  await requireRole(["admin"]);
  const id = form.get("id");
  const status = form.get("status");
  if (typeof id !== "string" ||
      !idPattern.test(id) ||
      typeof status !== "string" ||
      !statuses.some((value) => value === status)) {
    throw new Error("Invalid inquiry update");
  }
  const admin = createAdminClient();
  // Defense in depth: the DB CHECK constraint also rejects an unapproved
  // proposal/booking, even if application logic changes in the future.
  if (status === "proposed" || status === "booked") {
    const { data, error: readError } = await admin.from("diary_pr_inquiries")
      .select("compliance_status").eq("id", id).single();
    if (readError || data?.compliance_status !== "approved") {
      throw new Error("Compliance approval required before proposing or booking");
    }
  }
  const { data: updated, error } = await admin.from("diary_pr_inquiries")
    .update({ status }).eq("id", id).select("id").maybeSingle();
  if (error || !updated) throw new Error("Inquiry update failed");
  revalidatePath("/admin/diary-inquiries");
}
