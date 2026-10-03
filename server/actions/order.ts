"use server";

import { redirect } from "next/navigation";
import { buildDirectOfferSchedule } from "@/lib/direct-offer-schedule";
import { safeReturnTo } from "@/lib/return-to";
import { createClient } from "@/lib/supabase/server";

/** Restaurant orders a Creator's flat-rate plan: only dates and a note. */
export async function createFlatPlanOrder(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const page = safeReturnTo(`/order/${slug}`);
  if (!page) redirect("/");

  const back = (message: string): never =>
    redirect(`${page}?message=${encodeURIComponent(message)}`);

  let schedule;
  try {
    schedule = buildDirectOfferSchedule([
      String(formData.get("candidate1") ?? ""),
      String(formData.get("candidate2") ?? ""),
      String(formData.get("candidate3") ?? ""),
    ]);
  } catch {
    back("来店できる候補日時を1〜3つ、今より後の日時で入力してください。");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_flat_plan_order", {
    p_slug: slug,
    p_visit_period_start: schedule!.visitStart,
    p_visit_period_end: schedule!.visitEnd,
    p_application_deadline: schedule!.deadlineIso,
    p_slots: schedule!.slots,
    p_note: String(formData.get("note") ?? "").trim() || null,
  });

  if (error || !data) {
    const reason = error?.message ?? "";
    back(
      reason.includes("flat_plan_not_available")
        ? "現在このプランは受付を停止しています。"
        : reason.includes("restaurant_required")
          ? "店舗アカウントでログインしてください。"
          : "依頼を送れませんでした。候補日時をご確認ください。",
    );
  }

  redirect(
    "/restaurant/campaigns/" +
      data +
      "/applications?message=" +
      encodeURIComponent("依頼を送りました。Creatorが日時を選ぶと通知が届きます。"),
  );
}
