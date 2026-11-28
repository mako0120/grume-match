/**
 * Where a lead came from, so the owner can see which promotion works.
 * Only fixed keys are accepted: a `?ref=` value is never stored verbatim,
 * so a link cannot smuggle free text (or personal data) into the lead.
 */
export const DIARY_LEAD_SOURCES = {
  ig_bio: "Instagramプロフィールのリンク",
  ig_story: "Instagramストーリーズ",
  ig_post: "Instagram投稿・リール",
  ig_dm: "InstagramのDM",
  google: "Google検索・マップ",
  line: "LINE",
  card: "名刺・チラシ（QRコード）",
  referral: "知人・お店からの紹介",
  other: "その他",
} as const;

export type DiaryLeadSource = keyof typeof DIARY_LEAD_SOURCES;

/** Options for the optional "何で知りましたか" question (no DM: that is a reply channel). */
export const DIARY_HEARD_FROM_OPTIONS = (
  ["ig_post", "ig_bio", "google", "referral", "card", "other"] as const
).map((value) => ({ value, label: DIARY_LEAD_SOURCES[value] }));

export const DIARY_SOURCE_STORAGE_KEY = "diary-lead-source";

export function normalizeLeadSource(raw: unknown): DiaryLeadSource | "" {
  if (typeof raw !== "string") return "";
  const key = raw.trim().toLowerCase();
  return Object.hasOwn(DIARY_LEAD_SOURCES, key) ? (key as DiaryLeadSource) : "";
}
