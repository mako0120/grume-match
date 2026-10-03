"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseInsightLines } from "@/lib/creator-performance";
import { createClient } from "@/lib/supabase/server";

const PAGE = "/creator/performance";
const platforms = new Set(["instagram", "tiktok", "youtube", "threads"]);

function back(path: string, message: string, status: "ok" | "error"): never {
  const params = new URLSearchParams({ message, status });
  redirect(path + "?" + params.toString());
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/** Saves a pasted insights snapshot, replacing the same platform + date. */
export async function importInsights(formData: FormData) {
  const platform = String(formData.get("platform") ?? "instagram");
  const measuredOn = String(formData.get("measuredOn") ?? "");
  const text = String(formData.get("insights") ?? "");

  if (!platforms.has(platform)) back(PAGE, "SNSを選択してください。", "error");
  if (!isIsoDate(measuredOn)) back(PAGE, "計測日を確認してください。", "error");

  // Parse again on the server; the client preview is only a convenience.
  const { rows, errors } = parseInsightLines(text, measuredOn);
  if (errors.length) {
    back(PAGE, `${errors[0].line}行目: ${errors[0].reason}`, "error");
  }
  if (!rows.length) back(PAGE, "投稿を1件以上貼り付けてください。", "error");
  if (rows.length > 60) back(PAGE, "一度に登録できるのは60投稿までです。", "error");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("replace_creator_post_metrics", {
    p_platform: platform,
    p_measured_on: measuredOn,
    p_rows: rows.map((row) => ({
      area: row.area,
      headline: row.headline,
      post_url: row.postUrl,
      posted_on: row.postedOn,
      posted_on_approx: row.postedOnApprox,
      views: row.views,
      views_approx: row.viewsApprox,
      likes: row.likes,
      comments: row.comments,
      reposts: row.reposts,
      shares: row.shares,
      saves: row.saves,
    })),
  });

  if (error) {
    const reason = error.message ?? "";
    back(
      PAGE,
      reason.includes("invalid_measured_on")
        ? "計測日は今日以前の日付にしてください。"
        : reason.includes("invalid_metric_rows")
          ? "入力内容を確認してください（URLは https:// から、エリアは30文字以内）。"
          : "実績を保存できませんでした。",
      "error",
    );
  }

  revalidatePath(PAGE);
  back(PAGE, `${data ?? rows.length}投稿の実績を保存しました。`, "ok");
}

export async function deletePostMetric(formData: FormData) {
  const id = String(formData.get("metricId") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from("creator_post_metrics").delete().eq("id", id);

  if (error) back(PAGE, "削除できませんでした。", "error");

  revalidatePath(PAGE);
  back(PAGE, "投稿を削除しました。", "ok");
}

export type EvidenceResult = { ok: true } | { ok: false; message: string };

/** Called from the browser after the screenshot was uploaded to Storage. */
export async function registerEvidence(input: {
  platform: string;
  measuredOn: string;
  storagePath: string;
}): Promise<EvidenceResult> {
  if (!platforms.has(input.platform) || !isIsoDate(input.measuredOn) || !input.storagePath) {
    return { ok: false, message: "アップロード情報が不足しています。" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("register_performance_evidence", {
    p_platform: input.platform,
    p_measured_on: input.measuredOn,
    p_storage_path: input.storagePath,
  });

  if (error) {
    await supabase.storage.from("creator-evidence").remove([input.storagePath]);
    return {
      ok: false,
      message: (error.message ?? "").includes("unsupported_file_type")
        ? "スクリーンショットは画像ファイルでアップロードしてください。"
        : "スクリーンショットを登録できませんでした。",
    };
  }

  revalidatePath(PAGE);
  return { ok: true };
}

export async function reviewEvidence(formData: FormData) {
  const evidenceId = String(formData.get("evidenceId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const path = "/admin/performance";

  if (!evidenceId || !["approve", "reject"].includes(decision)) return;
  if (decision === "reject" && !note) {
    back(path, "差し戻す場合は理由を入力してください。", "error");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("review_performance_evidence", {
    p_evidence_id: evidenceId,
    p_approve: decision === "approve",
    p_note: note || null,
  });

  if (error) back(path, "確認結果を保存できませんでした。", "error");

  revalidatePath(path);
  back(
    path,
    decision === "approve"
      ? `${data ?? 0}投稿を運営確認済みにしました。`
      : "Creatorに差し戻しました。",
    "ok",
  );
}

/** Operator / Claude: register rows read from a screenshot (verified). */
export async function importFromEvidence(formData: FormData) {
  const evidenceId = String(formData.get("evidenceId") ?? "");
  const measuredOn = String(formData.get("measuredOn") ?? "");
  const text = String(formData.get("insights") ?? "");
  const path = "/admin/performance";

  if (!evidenceId || !isIsoDate(measuredOn)) back(path, "計測日を確認してください。", "error");

  const { rows, errors } = parseInsightLines(text, measuredOn);
  if (errors.length) back(path, `${errors[0].line}行目: ${errors[0].reason}`, "error");
  if (!rows.length) back(path, "読み取った投稿を入力してください。", "error");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_metrics_from_evidence", {
    p_evidence_id: evidenceId,
    p_measured_on: measuredOn,
    p_rows: rows.map((row) => ({
      area: row.area,
      headline: row.headline,
      post_url: row.postUrl,
      posted_on: row.postedOn,
      posted_on_approx: row.postedOnApprox,
      views: row.views,
      views_approx: row.viewsApprox,
      likes: row.likes,
      comments: row.comments,
      reposts: row.reposts,
      shares: row.shares,
      saves: row.saves,
    })),
  });

  if (error) back(path, "登録できませんでした。入力内容を確認してください。", "error");

  revalidatePath(path);
  back(path, `${data ?? rows.length}投稿を登録しました（運営確認済み）。`, "ok");
}
