"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function requestReschedule(bookingId: string, slotId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_booking_reschedule", {
    p_booking_id: bookingId,
    p_requested_slot_id: slotId,
  });

  if (error) {
    return { ok: false as const, message: "日時変更を申請できませんでした。" };
  }

  revalidatePath(`/creator/bookings/${bookingId}`);
  return { ok: true as const, id: data as string };
}

export async function reviewReschedule(
  requestId: string,
  bookingId: string,
  approve: boolean,
  note = "",
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("review_booking_reschedule", {
    p_request_id: requestId,
    p_approve: approve,
    p_note: note || null,
  });

  if (error) {
    return { ok: false as const, message: "日時変更を処理できませんでした。" };
  }

  revalidatePath("/restaurant");
  revalidatePath(`/restaurant/bookings/${bookingId}`);
  return { ok: true as const, id: data as string };
}
