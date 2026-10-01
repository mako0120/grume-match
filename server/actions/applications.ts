"use server";

import { applyToCampaign } from "@/server/services/apply-to-campaign";

type ApplicationPayload = {
  campaignId: string;
  partySize: number;
  exactSlotIds: string[];
  flexibleChoices: {
    dateLocal: string;
    afterLocal: string;
  }[];
};

export type ApplicationActionResult =
  | { ok: true; applicationId: string }
  | { ok: false; message: string };

export async function submitCampaignApplication(
  payload: ApplicationPayload,
): Promise<ApplicationActionResult> {
  if (
    !payload.campaignId ||
    payload.partySize < 1 ||
    (payload.exactSlotIds.length === 0 && payload.flexibleChoices.length === 0)
  ) {
    return { ok: false, message: "応募条件を確認してください。" };
  }

  try {
    const applicationId = await applyToCampaign(payload);
    return { ok: true, applicationId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message.includes("already_applied")) {
      return { ok: false, message: "この案件にはすでに応募済みです。" };
    }
    if (message.includes("invalid_or_closed_slot")) {
      return { ok: false, message: "選択した枠が埋まりました。別の時間を選択してください。" };
    }
    if (message.includes("application_deadline_passed")) {
      return { ok: false, message: "この案件の応募受付は終了しました。" };
    }
    if (message.includes("invalid_party_size")) {
      return { ok: false, message: "来店人数を確認してください。" };
    }
    if (message.includes("creator_not_targeted")) {
      return { ok: false, message: "この指名オファーは現在ご利用いただけません。" };
    }
    if (message.includes("no_open_slot_for_flexible_choice")) {
      return { ok: false, message: "選択した時間帯に空きがありません。別の時間を選択してください。" };
    }
    if (message.includes("campaign_not_accepting_applications")) {
      return { ok: false, message: "この案件の募集は終了しました。" };
    }

    return { ok: false, message: "応募できませんでした。時間を変更して再度お試しください。" };
  }
}
