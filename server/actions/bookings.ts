"use server";

import { revalidatePath } from "next/cache";
import { confirmBooking } from "@/server/services/confirm-booking";

export type BookingActionResult =
  | { ok: true; bookingId: string }
  | { ok: false; message: string };

export async function confirmApplicationBooking(
  campaignId: string,
  applicationId: string,
  slotId: string,
): Promise<BookingActionResult> {
  if (!campaignId || !applicationId || !slotId) {
    return { ok: false, message: "予約情報が不足しています。" };
  }

  try {
    const bookingId = await confirmBooking(applicationId, slotId);
    revalidatePath(`/restaurant/campaigns/${campaignId}/applications`);
    return { ok: true, bookingId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message.includes("slot_unavailable")) {
      return { ok: false, message: "この時間は直前に埋まりました。別の時間を選択してください。" };
    }
    if (message.includes("creator_schedule_conflict")) {
      return { ok: false, message: "Creatorの確定済み予定と重複しています。" };
    }
    if (message.includes("campaign_capacity_reached")) {
      return { ok: false, message: "この案件の採用枠はすべて確定しました。" };
    }
    if (message.includes("slot_not_selected_by_creator")) {
      return { ok: false, message: "Creatorが選択していない日時です。" };
    }

    return { ok: false, message: "予約を確定できませんでした。" };
  }
}
