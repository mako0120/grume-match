"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function withMessage(path: string, message: string, status: "ok" | "error") {
  const params = new URLSearchParams({ message, status });
  return path + "?" + params.toString();
}

export async function submitDeliverable(formData: FormData) {
  const deliverableId = String(formData.get("deliverableId") ?? "");
  const bookingId = String(formData.get("bookingId") ?? "");
  const url = String(formData.get("url") ?? "").trim();

  if (!deliverableId || !bookingId || !url) return;

  const path = "/creator/bookings/" + bookingId;
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_deliverable", {
    p_deliverable_id: deliverableId,
    p_url: url,
  });

  if (error) {
    const reason = error.message ?? "";

    if (reason.includes("invalid_deliverable_url")) {
      redirect(withMessage(path, "投稿URLを確認してください。", "error"));
    }

    if (reason.includes("booking_not_submittable")) {
      redirect(withMessage(path, "現在この投稿URLは提出できません。", "error"));
    }

    if (reason.includes("deliverable_already_approved")) {
      redirect(withMessage(path, "この投稿はすでに承認済みのため変更できません。", "error"));
    }

    redirect(withMessage(path, "投稿URLを保存できませんでした。もう一度お試しください。", "error"));
  }

  revalidatePath(path);
  redirect(withMessage(path, "投稿URLを提出しました。店舗の確認をお待ちください。", "ok"));
}

export async function reviewDeliverable(formData: FormData) {
  const deliverableId = String(formData.get("deliverableId") ?? "");
  const bookingId = String(formData.get("bookingId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const approved = decision === "approve";
  const note = String(formData.get("note") ?? "").trim();

  if (!deliverableId || !bookingId || !["approve", "reject"].includes(decision)) {
    return;
  }

  const path = "/restaurant/bookings/" + bookingId;

  if (!approved && !note) {
    redirect(withMessage(path, "修正を依頼する場合は、修正内容を入力してください。", "error"));
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_deliverable", {
    p_deliverable_id: deliverableId,
    p_approved: approved,
    p_note: note || null,
  });

  if (error) {
    const reason = error.message ?? "";

    if (reason.includes("deliverable_review_locked_after_payout_approval")) {
      redirect(withMessage(path, "報酬承認後の投稿状態は変更できません。", "error"));
    }

    redirect(withMessage(path, "投稿確認を更新できませんでした。もう一度お試しください。", "error"));
  }

  revalidatePath(path);
  revalidatePath("/restaurant");
  revalidatePath("/admin");
  revalidatePath("/creator/wallet");

  redirect(
    withMessage(
      path,
      approved
        ? "投稿を承認しました。"
        : "Creatorへ修正依頼を送りました。",
      "ok",
    ),
  );
}
