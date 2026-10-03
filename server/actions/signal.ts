"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSignalCode, normalizeSignalCode } from "@/lib/signal-metrics";
import { createClient } from "@/lib/supabase/server";

const SIGNAL_PATH = "/restaurant/signal";

function back(message: string, status: "ok" | "error"): never {
  const params = new URLSearchParams({ message, status });
  redirect(SIGNAL_PATH + "?" + params.toString());
}

function optionalInt(value: FormDataEntryValue | null) {
  const text = String(value ?? "").replace(/[,，\s]/g, "");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

const visitErrors: Array<[string, string]> = [
  ["signal_code_not_found", "このPRコードは見つかりませんでした。"],
  ["invalid_party_size", "人数は1〜50名で入力してください。"],
  ["invalid_revenue", "売上金額を確認してください。"],
  ["invalid_signal_date", "日付は今日から60日前までで選択してください。"],
];

export async function recordSignalVisit(formData: FormData) {
  const code = normalizeSignalCode(String(formData.get("code") ?? ""));
  const partySize = optionalInt(formData.get("partySize"));
  const revenue = optionalInt(formData.get("revenueYen"));
  const occurredOn = String(formData.get("occurredOn") ?? "").trim() || null;

  if (!isSignalCode(code)) back("PRコード（8文字）を確認してください。", "error");
  if (Number.isNaN(partySize)) back("人数を確認してください。", "error");
  if (Number.isNaN(revenue)) back("売上金額を確認してください。", "error");

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_signal_visit", {
    p_code: code,
    p_party_size: partySize,
    p_revenue_yen: revenue,
    p_occurred_on: occurredOn,
  });

  if (error) {
    const reason = error.message ?? "";
    const known = visitErrors.find(([key]) => reason.includes(key));
    back(known?.[1] ?? "記録できませんでした。もう一度お試しください。", "error");
  }

  revalidatePath(SIGNAL_PATH);
  back("来店を記録しました。", "ok");
}

export async function voidSignalVisit(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_signal_visit", {
    p_event_id: eventId,
  });

  if (error) back("取り消しできませんでした。", "error");

  revalidatePath(SIGNAL_PATH);
  back("記録を取り消しました。", "ok");
}
