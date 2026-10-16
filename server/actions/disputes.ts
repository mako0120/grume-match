"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function bookingPath(scope: "creator" | "restaurant", bookingId: string, message: string, status: "ok" | "error") {
  const params = new URLSearchParams({ message, status });
  return "/" + scope + "/bookings/" + bookingId + "?" + params.toString();
}

export async function openBookingDispute(formData: FormData) {
  const bookingId = String(formData.get("bookingId") ?? "");
  const scope =
    String(formData.get("scope") ?? "") === "restaurant"
      ? "restaurant"
      : "creator";
  const reason = String(formData.get("reason") ?? "").trim();

  if (!bookingId || !reason) {
    redirect(
      bookingPath(scope, bookingId, "確認してほしい内容を入力してください。", "error"),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("open_booking_dispute", {
    p_booking_id: bookingId,
    p_reason: reason,
  });

  if (error) {
    const code = error.message ?? "";
    const message = code.includes("dispute_already_open")
      ? "この案件はすでに運営確認中です。"
      : code.includes("booking_not_disputable")
        ? "この案件は運営確認を開始できない状態です。"
        : "運営確認を開始できませんでした。";

    redirect(bookingPath(scope, bookingId, message, "error"));
  }

  revalidatePath("/admin");
  revalidatePath("/admin/disputes");
  revalidatePath("/creator/bookings/" + bookingId);
  revalidatePath("/restaurant/bookings/" + bookingId);
  redirect(
    bookingPath(
      scope,
      bookingId,
      "運営確認を開始しました。報酬処理は確認が終わるまで保留されます。",
      "ok",
    ),
  );
}

export async function resolveBookingDispute(formData: FormData) {
  const disputeId = String(formData.get("disputeId") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!disputeId || !["resume", "cancel_unpaid"].includes(outcome)) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_booking_dispute", {
    p_dispute_id: disputeId,
    p_outcome: outcome,
    p_note: note || null,
  });

  if (error) {
    const code = error.message ?? "";
    const message = code.includes("paid_payment_cannot_be_cancelled")
      ? "支払済みの報酬はこの操作では取り消せません。"
      : code.includes("dispute_already_resolved")
        ? "この確認依頼はすでに解決済みです。"
        : "確認依頼を解決できませんでした。";

    redirect(
      "/admin/disputes?status=error&message=" + encodeURIComponent(message),
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/disputes");
  revalidatePath("/admin/payments");
  revalidatePath("/creator/wallet");
  redirect(
    "/admin/disputes?status=ok&message=" +
      encodeURIComponent(
        outcome === "resume"
          ? "確認を完了し、通常フローへ戻しました。"
          : "未払い報酬をキャンセルして確認を完了しました。",
      ),
  );
}
