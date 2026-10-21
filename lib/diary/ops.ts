import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const DIARY_OPS_COOKIE = "__Host-diary-ops";
export const DIARY_OPS_MAX_AGE = 60 * 60 * 12;

export function diaryOpsConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DIARY_OPS_ENABLED === "true" &&
    (env.DIARY_OPS_PASSWORD?.length ?? 0) >= 20 &&
    (env.DIARY_OPS_SESSION_SECRET?.length ?? 0) >= 32;
}

export function diaryOpsFormApiConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.NETLIFY_SITE_ID && env.DIARY_NETLIFY_API_TOKEN);
}

function safeEqual(a: string, b: string): boolean {
  const lhs = Buffer.from(a);
  const rhs = Buffer.from(b);
  return lhs.length === rhs.length && timingSafeEqual(lhs, rhs);
}

export function verifyDiaryOpsPassword(value: unknown, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!diaryOpsConfigured(env) || typeof value !== "string" || value.length > 512) return false;
  return safeEqual(value, env.DIARY_OPS_PASSWORD!);
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function createDiaryOpsSession(now = Date.now(), env: NodeJS.ProcessEnv = process.env): string {
  if (!diaryOpsConfigured(env)) throw new Error("Diary ops disabled");
  const body = [String(now), randomBytes(16).toString("hex")].join(".");
  return body + "." + sign(body, env.DIARY_OPS_SESSION_SECRET!);
}

export function verifyDiaryOpsSession(cookie: unknown, now = Date.now(), env: NodeJS.ProcessEnv = process.env): boolean {
  if (!diaryOpsConfigured(env) || typeof cookie !== "string" || cookie.length > 300) return false;
  const match = /^(\d{13})\.([0-9a-f]{32})\.([0-9a-f]{64})$/.exec(cookie);
  if (!match) return false;
  const issued = Number(match[1]);
  if (!Number.isSafeInteger(issued) || issued > now + 60_000 || now - issued > DIARY_OPS_MAX_AGE * 1000) return false;
  return safeEqual(match[3], sign(match[1] + "." + match[2], env.DIARY_OPS_SESSION_SECRET!));
}

const str = (v: unknown, limit = 2000): string => typeof v === "string" ? v.slice(0, limit) : "";
const validDate = (v: unknown): string => {
  const value = str(v, 40);
  return !Number.isNaN(Date.parse(value)) ? value : "";
};

export interface DiaryOpsLead {
  id: string;
  createdAt: string;
  restaurant: string;
  contact: string;
  email: string;
  service: string;
  inquiryKind: string;
  message: string;
  featuredMenu: string;
  visitPreference: string;
}

export function normalizeDiaryOpsLead(value: unknown): DiaryOpsLead | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const data = raw.data && typeof raw.data === "object" && !Array.isArray(raw.data) ? raw.data as Record<string, unknown> : {};
  const id = str(raw.id, 128);
  if (!/^[A-Za-z0-9_-]{4,128}$/.test(id)) return null;
  return {
    id,
    createdAt: validDate(raw.created_at),
    restaurant: str(data.restaurant_name, 120) || "店舗名未入力",
    contact: str(data.contact_name, 100),
    email: str(data.email, 254),
    service: str(data.service, 70),
    inquiryKind: str(data.inquiry_kind, 30),
    message: str(data.message, 2000),
    featuredMenu: str(data.featured_menu, 500),
    visitPreference: str(data.visit_preference, 600),
  };
}

function csvCell(value: string): string {
  // Excel / Google Sheets can interpret untrusted form input as formulas.
  const cleaned = /^[\s]*[=+@\-\t\r]/.test(value) ? "'" + value : value;
  return '"' + cleaned.replace(/"/g, '""') + '"';
}

export function diaryOpsCsv(leads: DiaryOpsLead[]): string {
  const columns: Array<[string, keyof DiaryOpsLead]> = [
    ["Netlify受付ID", "id"], ["受付日時", "createdAt"], ["店舗・企業名", "restaurant"],
    ["担当者", "contact"], ["メールアドレス", "email"], ["PRプラン", "service"],
    ["申込み種別", "inquiryKind"], ["相談内容", "message"],
    ["紹介メニュー", "featuredMenu"], ["来店希望日", "visitPreference"],
  ];
  return "\uFEFF" + [columns.map(([heading]) => csvCell(heading)).join(","),
    ...leads.map(lead => columns.map(([, key]) => csvCell(lead[key])).join(","))].join("\r\n");
}
