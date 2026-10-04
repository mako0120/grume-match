"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UGC_BUCKET } from "@/lib/content-rights";
import { createClient } from "@/lib/supabase/server";

function withMessage(path: string, message: string, status: "ok" | "error") {
  const params = new URLSearchParams({ message, status });
  return path + "?" + params.toString();
}

const registerErrors: Array<[string, string]> = [
  ["unsupported_file_type", "対応していないファイル形式です。"],
  ["file_too_large", "ファイルサイズが上限を超えています。"],
  ["too_many_assets", "1つの納品物にアップロードできるのは10ファイルまでです。"],
  ["upload_not_found", "アップロードが完了していません。もう一度お試しください。"],
  ["not_authorized", "この納品物にはアップロードできません。"],
  ["deliverable_not_ugc", "この納品物はURLで提出してください。"],
];

export type RegisterUgcAssetResult = { ok: true } | { ok: false; message: string };

/**
 * Called from the browser after a file was uploaded straight to Storage.
 * The database re-validates path, ownership, type and size from Storage
 * metadata before the file becomes part of the deliverable.
 */
export async function registerUgcAsset(input: {
  deliverableId: string;
  bookingId: string;
  storagePath: string;
}): Promise<RegisterUgcAssetResult> {
  if (!input.deliverableId || !input.bookingId || !input.storagePath) {
    return { ok: false, message: "アップロード情報が不足しています。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("register_content_asset", {
    p_deliverable_id: input.deliverableId,
    p_storage_path: input.storagePath,
  });

  if (error) {
    // Do not leave an unregistered file behind.
    await supabase.storage.from(UGC_BUCKET).remove([input.storagePath]);

    const reason = error.message ?? "";
    const known = registerErrors.find(([code]) => reason.includes(code));
    return {
      ok: false,
      message: known?.[1] ?? "ファイルを登録できませんでした。もう一度お試しください。",
    };
  }

  revalidatePath("/creator/bookings/" + input.bookingId);
  return { ok: true };
}

export async function removeUgcAsset(formData: FormData) {
  const assetId = String(formData.get("assetId") ?? "");
  const bookingId = String(formData.get("bookingId") ?? "");
  if (!assetId || !bookingId) return;

  const path = "/creator/bookings/" + bookingId;
  const supabase = await createClient();
  const { data: storagePath, error } = await supabase.rpc("remove_content_asset", {
    p_asset_id: assetId,
  });

  if (error || typeof storagePath !== "string") {
    const reason = error?.message ?? "";
    redirect(
      withMessage(
        path,
        reason.includes("deliverable_already_approved")
          ? "承認済みの素材は削除できません。"
          : "素材を削除できませんでした。",
        "error",
      ),
    );
  }

  await supabase.storage.from(UGC_BUCKET).remove([storagePath]);

  revalidatePath(path);
  redirect(withMessage(path, "素材を削除しました。", "ok"));
}

export async function submitUgcDeliverable(formData: FormData) {
  const deliverableId = String(formData.get("deliverableId") ?? "");
  const bookingId = String(formData.get("bookingId") ?? "");
  if (!deliverableId || !bookingId) return;

  const path = "/creator/bookings/" + bookingId;
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_ugc_deliverable", {
    p_deliverable_id: deliverableId,
  });

  if (error) {
    const reason = error.message ?? "";
    const message = reason.includes("ugc_files_required")
      ? "先に写真・動画をアップロードしてください。"
      : reason.includes("booking_not_submittable")
        ? "現在この素材は納品できません。"
        : reason.includes("deliverable_already_approved")
          ? "この素材はすでに承認済みです。"
          : "納品できませんでした。もう一度お試しください。";

    redirect(withMessage(path, message, "error"));
  }

  revalidatePath(path);
  redirect(withMessage(path, "素材を納品しました。店舗の確認をお待ちください。", "ok"));
}
