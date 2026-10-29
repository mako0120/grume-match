/**
 * Public Instagram DM handoff while first-party inquiry storage is disabled.
 * Only predetermined labels become copy; no personal details are sent or stored.
 */
const SERVICE_LABELS: Record<string, string> = {
  instagram_feed: "写真フィードPR（Instagram投稿1件）",
  instagram_feed_video: "写真フィード＋ショート動画",
  monthly_photo: "毎月フォトPR（月29,800円・税込、事前相談）",
  monthly_growth: "毎月フォト＋リールPR（月49,800円・税込、事前相談）",
  instagram_reel: "リール動画",
  instagram_stories: "ストーリーズ",
  photo_video: "店舗の写真・動画素材",
  consultation: "Instagram PRの事前相談",
};

const GOAL_LABELS: Record<string, string> = {
  "新メニューを紹介したい": "新メニューを紹介したい",
  "初めてのお客様にお店を知ってほしい": "初めてのお客様にお店を知ってほしい",
  "お店のこだわりを伝えたい": "料理やお店のこだわりを伝えたい",
};

export function buildDiaryDmTemplate({
  service = "",
  goal = "",
  inquiryKind = "consultation",
}: {
  service?: string;
  goal?: string;
  inquiryKind?: "consultation" | "application";
} = {}): string {
  const serviceLabel = SERVICE_LABELS[service] ?? "Instagram PR";
  const goalLabel = GOAL_LABELS[goal] ?? "料理やお店の魅力を知ってもらいたい";
  const request = inquiryKind === "application"
    ? "PR依頼について、内容と来店可能日を相談させてください。"
    : "PRの内容と料金について、まずは相談させてください。";
  return [
    "グルメ日誌様",
    "はじめまして。大阪の飲食店からご連絡しました。",
    "",
    "【店舗名】（お店の名前をご記入ください）",
    `【ご希望のPR】${serviceLabel}`,
    `【PRの目的】${goalLabel}`,
    "【紹介したいメニュー】（あればご記入ください）",
    "【ご希望の来店時期】（未定でも大丈夫です）",
    "",
    request,
    "よろしくお願いいたします。",
  ].join("\n");
}
