import { createClient } from "@/lib/supabase/server";

export type CommercialIntegrityItem = {
  key: string;
  label: string;
  violations: number;
  ok: boolean;
};

const labels: Record<string, string> = {
  paid_without_transfer_reference: "支払済みなのに振込参照番号なし",
  scheduled_or_paid_without_payout_profile: "振込先なしで支払い進行",
  open_dispute_with_moving_payout: "運営確認中なのに報酬が保留外",
  cancelled_booking_with_unsettled_payout: "キャンセル済みなのに未精算報酬あり",
  overbooked_slots: "定員超過の来店枠",
  live_zero_cash_campaigns: "現金報酬0円の公開案件",
  direct_campaign_target_mismatch: "指名案件の対象Creator不整合",
  approved_deliverable_without_url: "URLなしで承認済み投稿",
  payable_booking_with_unapproved_deliverable: "未承認投稿があるのに支払い進行",
  stale_dispute_application: "運営確認状態の孤立応募",
};

export async function getCommercialIntegrity() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("commercial_integrity_report");

  if (error) {
    return {
      available: false,
      ready: false,
      items: [] as CommercialIntegrityItem[],
    };
  }

  const report =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};

  const items = Object.entries(labels).map(([key, label]) => {
    const raw = Number(report[key] ?? 0);
    const violations = Number.isFinite(raw) ? raw : 0;

    return {
      key,
      label,
      violations,
      ok: violations === 0,
    };
  });

  return {
    available: true,
    ready: items.every((item) => item.ok),
    items,
  };
}
