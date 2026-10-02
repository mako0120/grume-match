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

const conversionErrors: Array<[string, string]> = [
  ["signal_code_not_found", "このPRコードは見つかりませんでした。"],
  ["invalid_party_size", "人数は1〜50名で入力してください。"],
  ["invalid_revenue", "売上金額を確認してください。"],
  ["revenue_only_for_visits", "売上は来店の記録にだけ入力できます。"],
  ["invalid_signal_date", "日付は今日から60日前までで選択してください。"],
];

export async function recordSignalConversion(formData: FormData) {
  const code = normalizeSignalCode(String(formData.get("code") ?? ""));
  const kind = String(formData.get("kind") ?? "");
  const partySize = optionalInt(formData.get("partySize"));
  const revenue = kind === "visit" ? optionalInt(formData.get("revenueYen")) : null;
  const occurredOn = String(formData.get("occurredOn") ?? "").trim() || null;

  if (!isSignalCode(code)) back("PRコード（8文字）を確認してください。", "error");
  if (kind !== "reservation" && kind !== "visit") back("予約か来店を選択してください。", "error");
  if (Number.isNaN(partySize)) back("人数を確認してください。", "error");
  if (Number.isNaN(revenue)) back("売上金額を確認してください。", "error");

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_signal_conversion", {
    p_code: code,
    p_kind: kind,
    p_party_size: partySize,
    p_revenue_yen: revenue,
    p_occurred_on: occurredOn,
  });

  if (error) {
    const reason = error.message ?? "";
    const known = conversionErrors.find(([key]) => reason.includes(key));
    back(known?.[1] ?? "記録できませんでした。もう一度お試しください。", "error");
  }

  revalidatePath(SIGNAL_PATH);
  back(kind === "visit" ? "来店を記録しました。" : "予約を記録しました。", "ok");
}

export async function voidSignalConversion(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_signal_conversion", {
    p_event_id: eventId,
  });

  if (error) back("取り消しできませんでした。", "error");

  revalidatePath(SIGNAL_PATH);
  back("記録を取り消しました。", "ok");
}

export async function updateRestaurantContact(formData: FormData) {
  const restaurantId = String(formData.get("restaurantId") ?? "");
  if (!restaurantId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_restaurant_contact", {
    p_restaurant_id: restaurantId,
    p_phone: String(formData.get("phone") ?? ""),
    p_reservation_url: String(formData.get("reservationUrl") ?? ""),
  });

  if (error) {
    const reason = error.message ?? "";
    back(
      reason.includes("invalid_phone")
        ? "電話番号は数字とハイフンで入力してください。"
        : reason.includes("invalid_reservation_url")
          ? "予約ページのURLは https:// から入力してください。"
          : "保存できませんでした。",
      "error",
    );
  }

  revalidatePath(SIGNAL_PATH);
  back("予約導線を保存しました。", "ok");
}
