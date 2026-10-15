"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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


function bookingResultPath(
  scope: "creator" | "restaurant",
  bookingId: string,
  status: "ok" | "error",
  message: string,
) {
  const params = new URLSearchParams({ status, message });
  return "/" + scope + "/bookings/" + bookingId + "?" + params.toString();
}

export async function markBookingVisited(formData: FormData) {
  const bookingId = String(formData.get("bookingId") ?? "");
  if (!bookingId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_booking_visited", {
    p_booking_id: bookingId,
  });

  if (error) {
    const reason = error.message ?? "";
    const message = reason.includes("visit_not_started")
      ? "来店開始時刻より前は来店済みにできません。"
      : reason.includes("booking_not_visitable")
        ? "この来店は現在、来店済みに変更できません。"
        : reason.includes("booking_locked_by_dispute")
          ? "この案件は運営確認中のため、来店状態を変更できません。"
          : "来店確認を更新できませんでした。";

    redirect(bookingResultPath("restaurant", bookingId, "error", message));
  }

  revalidatePath("/restaurant");
  revalidatePath("/restaurant/bookings");
  revalidatePath("/creator/bookings");
  revalidatePath("/creator/bookings/" + bookingId);
  redirect(
    bookingResultPath(
      "restaurant",
      bookingId,
      "ok",
      "来店済みにしました。Creatorは投稿URLを提出できます。",
    ),
  );
}

export async function cancelBooking(formData: FormData) {
  const bookingId = String(formData.get("bookingId") ?? "");
  const scope =
    String(formData.get("scope") ?? "") === "restaurant"
      ? "restaurant"
      : "creator";
  const reason = String(formData.get("reason") ?? "").trim();

  if (!bookingId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_booking", {
    p_booking_id: bookingId,
    p_reason: reason || null,
  });

  if (error) {
    const code = error.message ?? "";
    const message = code.includes("visit_already_started")
      ? "来店開始後は通常キャンセルできません。店舗側で来店状況を確認してください。"
      : code.includes("booking_not_cancellable")
        ? "この来店はすでに処理済みです。"
        : code.includes("booking_locked_by_dispute")
          ? "この案件は運営確認中のため、現在はキャンセルできません。"
          : "キャンセル処理に失敗しました。";

    redirect(bookingResultPath(scope, bookingId, "error", message));
  }

  revalidatePath("/restaurant");
  revalidatePath("/restaurant/bookings");
  revalidatePath("/creator/bookings");
  revalidatePath("/creator/wallet");
  revalidatePath("/admin");
  redirect(
    bookingResultPath(
      scope,
      bookingId,
      "ok",
      "来店をキャンセルしました。相手にも通知されます。",
    ),
  );
}

export async function markBookingNoShow(formData: FormData) {
  const bookingId = String(formData.get("bookingId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!bookingId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_booking_no_show", {
    p_booking_id: bookingId,
    p_reason: reason || null,
  });

  if (error) {
    const code = error.message ?? "";
    const message = code.includes("no_show_too_early")
      ? "来店予定時刻から30分経過するまで来店なしにはできません。"
      : code.includes("booking_not_no_showable")
        ? "この来店はすでに処理済みです。"
        : code.includes("booking_locked_by_dispute")
          ? "この案件は運営確認中のため、来店状態を変更できません。"
          : "来店なしを記録できませんでした。";

    redirect(bookingResultPath("restaurant", bookingId, "error", message));
  }

  revalidatePath("/restaurant");
  revalidatePath("/restaurant/bookings");
  revalidatePath("/creator/bookings");
  revalidatePath("/creator/wallet");
  revalidatePath("/admin");
  redirect(
    bookingResultPath(
      "restaurant",
      bookingId,
      "ok",
      "来店なしとして記録しました。運営Inboxにも反映されます。",
    ),
  );
}
