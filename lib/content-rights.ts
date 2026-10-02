// Structured content usage rights and UGC upload rules (P2-03 STUDIO).
// Mirrors the constraints in supabase/migrations/202610030001_ugc_studio.sql.

export type UsageScope = "organic" | "organic_and_ads";

export type UsageRights = {
  scope: UsageScope;
  duration_days: UsageDuration;
  fee: number;
};

export const USAGE_DURATIONS = [30, 90, 365] as const;
export type UsageDuration = (typeof USAGE_DURATIONS)[number];

export const MAX_USAGE_FEE = 1_000_000;

export const usageScopeLabels: Record<UsageScope, string> = {
  organic: "店舗SNS・Webで利用",
  organic_and_ads: "店舗SNS・Web＋広告で利用",
};

export class UsageRightsInputError extends Error {}

/**
 * Parse the usage-rights part of a campaign form.
 *
 * `mode` is "none", "organic" or "organic_and_ads". Returns null when the
 * Restaurant does not request secondary use.
 */
export function parseUsageRightsInput(input: {
  mode: string;
  durationDays: string;
  fee: string;
}): UsageRights | null {
  if (input.mode === "none" || input.mode === "") return null;

  if (input.mode !== "organic" && input.mode !== "organic_and_ads") {
    throw new UsageRightsInputError("二次利用の範囲を選択してください。");
  }

  const duration = Number(input.durationDays);
  if (!USAGE_DURATIONS.includes(duration as UsageDuration)) {
    throw new UsageRightsInputError("利用期間は30日・90日・365日から選択してください。");
  }

  const feeText = input.fee.trim();
  const fee = feeText === "" ? 0 : Number(feeText);
  if (!Number.isInteger(fee) || fee < 0 || fee > MAX_USAGE_FEE) {
    throw new UsageRightsInputError("二次利用料を確認してください。");
  }

  if (input.mode === "organic_and_ads" && fee === 0) {
    throw new UsageRightsInputError("広告で利用する場合は二次利用料を設定してください。");
  }

  return {
    scope: input.mode,
    duration_days: duration as UsageDuration,
    fee,
  };
}

export function describeUsageRights(rights: {
  usageScope: UsageScope;
  durationDays: number;
  fee: number;
}) {
  const fee = rights.fee > 0 ? `＋¥${rights.fee.toLocaleString()}` : "追加料金なし";
  return `${usageScopeLabels[rights.usageScope]}・${rights.durationDays}日間・${fee}`;
}

export type LicenseState = "not_started" | "active" | "expiring" | "expired";

const DAY_MS = 24 * 60 * 60 * 1000;
export const LICENSE_EXPIRING_DAYS = 7;

export function licenseState(
  license: { status: string; expiresAt: string | null },
  now: Date = new Date(),
): { state: LicenseState; daysLeft: number | null } {
  if (license.status !== "active" || !license.expiresAt) {
    return { state: "not_started", daysLeft: null };
  }

  const remainingMs = new Date(license.expiresAt).getTime() - now.getTime();
  if (remainingMs <= 0) return { state: "expired", daysLeft: 0 };

  const daysLeft = Math.ceil(remainingMs / DAY_MS);
  return {
    state: daysLeft <= LICENSE_EXPIRING_DAYS ? "expiring" : "active",
    daysLeft,
  };
}

export const licenseStateLabels: Record<LicenseState, string> = {
  not_started: "承認後に開始",
  active: "利用可能",
  expiring: "まもなく期限",
  expired: "期限切れ",
};

// ---------------------------------------------------------------------------
// UGC files
// ---------------------------------------------------------------------------

export type UgcKind = "photo" | "video";

export const UGC_BUCKET = "ugc-assets";
export const MAX_UGC_FILES_PER_DELIVERABLE = 10;

export const ugcRules: Record<
  UgcKind,
  { mimeTypes: readonly string[]; maxBytes: number; accept: string }
> = {
  photo: {
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
    maxBytes: 15 * 1024 * 1024,
    accept: "image/jpeg,image/png,image/webp,image/heic,image/heif",
  },
  video: {
    mimeTypes: ["video/mp4", "video/quicktime"],
    maxBytes: 50 * 1024 * 1024,
    accept: "video/mp4,video/quicktime",
  },
};

export function ugcKindForPlatform(platform: string): UgcKind | null {
  if (platform === "ugc_photo") return "photo";
  if (platform === "ugc_video") return "video";
  return null;
}

/** Returns a user-facing error message, or null when the file is acceptable. */
export function validateUgcFile(
  kind: UgcKind,
  file: { type: string; size: number },
): string | null {
  const rule = ugcRules[kind];

  if (!rule.mimeTypes.includes(file.type)) {
    return kind === "photo"
      ? "写真はJPEG・PNG・WebP・HEICでアップロードしてください。"
      : "動画はMP4・MOVでアップロードしてください。";
  }

  if (file.size <= 0) return "空のファイルはアップロードできません。";

  if (file.size > rule.maxBytes) {
    return `ファイルサイズは${Math.floor(rule.maxBytes / 1024 / 1024)}MB以下にしてください。`;
  }

  return null;
}

const extensionByMime: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

/**
 * Storage object path accepted by the `ugc-assets` bucket policy:
 * `<auth uid>/<deliverable id>/<random id>.<ext>`.
 */
export function ugcObjectPath(
  userId: string,
  deliverableId: string,
  mimeType: string,
  randomId: string,
) {
  const extension = extensionByMime[mimeType];
  if (!extension) throw new Error("unsupported_file_type");

  const safeId = randomId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  if (!safeId) throw new Error("invalid_file_id");

  return `${userId}/${deliverableId}/${safeId}.${extension}`;
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}
