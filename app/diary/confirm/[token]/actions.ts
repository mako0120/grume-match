"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { bookingTokenHash } from "@/lib/diary/booking";
import { sendOperatorBookingNotification } from "@/server/diary/notification";
import { createDiaryDraftInvoice } from "@/server/diary/invoicing";

export async function confirmDiaryBooking(form: FormData) {
  const token = form.get("token");
  const hash = typeof token === "string" ? bookingTokenHash(token) : null;
  if (!hash || form.get("accepted") !== "on") throw new Error("Confirmation or token missing");

  const admin = createAdminClient();
  const now = new Date().toISOString();
  // Conditional, single-use update: only an active reviewed proposal can book.
  const { data, error } = await admin.from("diary_pr_inquiries").update({
    status: "booked",
    confirmed_at: now,
    proposal_token_hash: null,
    proposal_expires_at: null,
    operator_notify_state: "pending",
    operator_notify_attempts: 0,
  }).eq("proposal_token_hash", hash)
    .eq("status", "proposed")
    .eq("inquiry_kind", "application")
    .eq("compliance_status", "approved")
    .gt("proposal_expires_at", now)
    .select("id").maybeSingle();
  if (error || !data) throw new Error("Could not confirm. The link may be expired, already used, or the date already booked.");

  // Draft only. If Stripe is not yet configured, the worker creates it later.
  await createDiaryDraftInvoice(data.id);
  await sendOperatorBookingNotification(data.id);
  redirect("/diary/confirmed");
}
