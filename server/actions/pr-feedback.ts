"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function bookingPath(viewer: string, bookingId: string) {
  return viewer === "restaurant"
    ? `/restaurant/bookings/${bookingId}`
    : `/creator/bookings/${bookingId}`;
}

function back(path: string, message: string, status: "ok" | "error"): never {
  const params = new URLSearchParams({ message, status });
  redirect(path + "?" + params.toString());
}

const reviewErrors: Array<[string, string]> = [
  ["review_not_open", "投稿の承認後に評価できます。"],
  ["already_reviewed", "このPRはすでに評価済みです。"],
  ["invalid_rating", "星の数を選んでください。"],
  ["invalid_review_tag", "選べない項目が含まれています。"],
  ["review_comment_too_long", "コメントは300文字以内にしてください。"],
];

export async function submitReview(formData: FormData) {
  const bookingId = String(formData.get("bookingId") ?? "");
  const viewer = String(formData.get("viewer") ?? "creator");
  const path = bookingPath(viewer, bookingId);
  const rating = Number(formData.get("rating"));
  const tags = formData.getAll("tags").map(String);
  const comment = String(formData.get("comment") ?? "").trim();

  if (!bookingId) return;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    back(path, "星の数を選んでください。", "error");
  }
  if (comment.length > 300) back(path, "コメントは300文字以内にしてください。", "error");

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_pr_review", {
    p_booking_id: bookingId,
    p_rating: rating,
    p_tags: tags,
    p_comment: comment || null,
  });

  if (error) {
    const reason = error.message ?? "";
    const known = reviewErrors.find(([key]) => reason.includes(key));
    back(path, known?.[1] ?? "評価を送信できませんでした。", "error");
  }

  revalidatePath(path);
  back(path, "評価を送信しました。相手も評価すると、お互いの評価が表示されます。", "ok");
}

export async function registerPostReport(input: {
  bookingId: string;
  deliverableId: string;
  storagePath: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_pr_post_report", {
    p_deliverable_id: input.deliverableId,
    p_storage_path: input.storagePath,
  });

  if (error) {
    const reason = error.message ?? "";
    return {
      ok: false,
      message: reason.includes("post_not_submitted")
        ? "先に投稿URLを提出してください。"
        : reason.includes("post_report_already_verified")
          ? "この投稿のレポートは登録済みです。"
          : reason.includes("unsupported_file_type")
            ? "スクリーンショットの画像を選んでください。"
            : "送信できませんでした。もう一度お試しください。",
    };
  }

  revalidatePath(`/creator/bookings/${input.bookingId}`);
  return { ok: true };
}
