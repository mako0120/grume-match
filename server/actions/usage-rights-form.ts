import {
  parseUsageRightsInput,
  ugcKindForPlatform,
  UsageRightsInputError,
  type UsageRights,
} from "@/lib/content-rights";

export type UsageRightsFormResult =
  | { ok: true; usageRights: UsageRights | null }
  | { ok: false; message: string };

// Reads the <UsageRightsFields /> inputs for a campaign form.
export function readUsageRightsForm(
  formData: FormData,
  platforms: string[],
): UsageRightsFormResult {
  let usageRights: UsageRights | null;

  try {
    usageRights = parseUsageRightsInput({
      mode: String(formData.get("usageMode") ?? "none"),
      durationDays: String(formData.get("usageDurationDays") ?? ""),
      fee: String(formData.get("usageFee") ?? ""),
    });
  } catch (error) {
    if (error instanceof UsageRightsInputError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  if (!usageRights && platforms.some((platform) => ugcKindForPlatform(platform))) {
    return {
      ok: false,
      message: "UGC写真・動画を依頼する場合は、二次利用の範囲と期間を設定してください。",
    };
  }

  return { ok: true, usageRights };
}
