"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function submitDeliverable(formData: FormData) {
  const deliverableId = String(formData.get("deliverableId") ?? "");
  const bookingId = String(formData.get("bookingId") ?? "");
  const url = String(formData.get("url") ?? "").trim();

  if (!deliverableId || !bookingId || !url) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_deliverable", {
    p_deliverable_id: deliverableId,
    p_url: url,
  });

  if (!error) {
    revalidatePath(`/creator/bookings/${bookingId}`);
  }
}

export async function reviewDeliverable(formData: FormData) {
  const deliverableId = String(formData.get("deliverableId") ?? "");
  const bookingId = String(formData.get("bookingId") ?? "");
  const approved = String(formData.get("decision") ?? "") === "approve";
  const note = String(formData.get("note") ?? "").trim();

  if (!deliverableId || !bookingId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_deliverable", {
    p_deliverable_id: deliverableId,
    p_approved: approved,
    p_note: note || null,
  });

  if (!error) {
    revalidatePath(`/restaurant/bookings/${bookingId}`);
  }
}
