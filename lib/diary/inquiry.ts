export const DIARY_SERVICES = [
  "instagram_feed",
  "instagram_feed_video",
  "instagram_reel",
  "instagram_stories",
  "photo_video",
  "consultation",
] as const;

export const DIARY_BUDGETS = [
  "undecided",
  "under_10000",
  "10000_30000",
  "30000_50000",
  "over_50000",
] as const;

export type DiaryService = (typeof DIARY_SERVICES)[number];
export type DiaryBudget = (typeof DIARY_BUDGETS)[number];

export type DiaryInquiry = {
  restaurant_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  instagram_url: string | null;
  service: DiaryService;
  budget: DiaryBudget;
  desired_period: string | null;
  message: string;
  consent: true;
  compliance_confirmed: true;
};

function clean(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.trim().slice(0, maximum + 1) : "";
}

/**
 * This is a conservative pre-screen, not a substitute for manual review.
 * In the direct PR channel, we reject review-site work (including ambiguous
 * reviews/rating requests) rather than risk accepting incentivized reviews.
 */
export function detectProhibitedPRRequest(text: string): string | null {
  const normalized = text.normalize("NFKC").toLowerCase().replace(/[\s　]+/g, "");
  if (/(食べログ|たべろぐ|tabelog|googleマップ|googlemaps?|グーグルマップ|ぐーぐるまっぷ|口コミ|クチコミ|くちこみ|レビュー|review|rating|評点|星[1-5]|★[1-5]|高評価)/i.test(normalized)) {
    return "口コミサイトへの投稿・評価指定を含むご依頼はお受けできません。Instagram等の適切なPRのみご相談ください。";
  }
  if (/(pr表記.{0,6}(なし|不要|外す|しない|隠す)|広告表記.{0,6}(なし|不要|外す|しない|隠す)|宣伝とわからない|案件とわからない|広告だとわからない|ステマ)/i.test(normalized)) {
    return "広告・PR関係を隠すご依頼はお受けできません。";
  }
  if (/(好意的な感想.{0,6}(必須|条件)|必ず.{0,10}(褒め|絶賛)|絶賛して|最高と書いて|来店せずに体験|食べずに感想|食べてないけど感想)/i.test(normalized)) {
    return "評価の強制や実体験に基づかない投稿のご依頼はお受けできません。";
  }
  return null;
}

export function validateDiaryInquiry(input: unknown):
  | { ok: true; data: DiaryInquiry }
  | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "invalid_payload" };
  }
  const body = input as Record<string, unknown>;
  const restaurant_name = clean(body.restaurant_name, 100);
  const contact_name = clean(body.contact_name, 80);
  const email = clean(body.email, 254).toLowerCase();
  const phone = clean(body.phone, 30);
  const instagram_url = clean(body.instagram_url, 250);
  const desired_period = clean(body.desired_period, 120);
  const message = clean(body.message, 2000);
  const service = body.service;
  const budget = body.budget;

  if (!restaurant_name || restaurant_name.length > 100 ||
      !contact_name || contact_name.length > 80 ||
      !email || email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      phone.length > 30 || desired_period.length > 120 ||
      message.length > 2000 || message.length < 10) {
    return { ok: false, error: "invalid_contact_details" };
  }
  if (!DIARY_SERVICES.some((option) => option === service) ||
      !DIARY_BUDGETS.some((option) => option === budget)) {
    return { ok: false, error: "invalid_service_or_budget" };
  }
  if (instagram_url) {
    try {
      const parsed = new URL(instagram_url);
      if (parsed.protocol !== "https:" ||
          !["instagram.com", "www.instagram.com"].includes(parsed.hostname) ||
          parsed.username || parsed.password) {
        return { ok: false, error: "invalid_instagram_url" };
      }
    } catch {
      return { ok: false, error: "invalid_instagram_url" };
    }
  }
  if (body.consent !== true) {
    return { ok: false, error: "consent_required" };
  }
  if (body.compliance_confirmed !== true) {
    return { ok: false, error: "compliance_acknowledgement_required" };
  }
  const prohibited = detectProhibitedPRRequest([restaurant_name, desired_period, message].join(" "));
  if (prohibited) return { ok: false, error: prohibited };
  return {
    ok: true,
    data: {
      restaurant_name,
      contact_name,
      email,
      phone: phone || null,
      instagram_url: instagram_url || null,
      service: service as DiaryService,
      budget: budget as DiaryBudget,
      desired_period: desired_period || null,
      message,
      consent: true,
      compliance_confirmed: true,
    },
  };
}
