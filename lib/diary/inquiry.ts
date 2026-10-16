export const DIARY_SERVICES = [
  "instagram_feed",
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
};

function clean(value: unknown, maximum: number): string {
  return typeof value === "string" ? value.trim().slice(0, maximum + 1) : "";
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
    },
  };
}
