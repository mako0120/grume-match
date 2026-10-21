/**
 * Local-only PR management helpers.
 *
 * SECURITY MODEL:
 * No Netlify API tokens or customer data are fetched or stored on the server.
 * The browser parses an owner-selected CSV entirely in volatile memory.
 * Nothing is sent over the network or persisted to localStorage/cookies.
 * CSV re-export neutralizes spreadsheet formula injection.
 */
export type DiaryOpsStatus =
  | "未対応" | "返信済" | "見積・条件調整" | "成約" | "来店済"
  | "制作中" | "投稿済" | "請求済" | "入金済" | "完了" | "終了";

export const DIARY_OPS_STATUSES: DiaryOpsStatus[] = [
  "未対応", "返信済", "見積・条件調整", "成約", "来店済",
  "制作中", "投稿済", "請求済", "入金済", "完了", "終了",
];
export const DIARY_OPS_STAGES = [
  { title: "新規", statuses: ["未対応"] },
  { title: "連絡・見積", statuses: ["返信済", "見積・条件調整"] },
  { title: "成約・来店", statuses: ["成約", "来店済"] },
  { title: "制作・公開", statuses: ["制作中", "投稿済"] },
  { title: "請求・完了", statuses: ["請求済", "入金済", "完了"] },
] as const;

export interface DiaryOpsCase {
  id: string;
  receivedAt: string;
  restaurant: string;
  contact: string;
  email: string;
  service: string;
  kind: string;
  message: string;
  featuredMenu: string;
  visitPreference: string;
  status: DiaryOpsStatus;
  nextAction: string;
  dueDate: string;
  visitDate: string;
  postDate: string;
  agreedFee: number;
  paidAmount: number;
  note: string;
  postUrl: string;
}

const LIMIT_ROWS = 1000;
const LIMIT_FILE_BYTES = 2_000_000;
const MAX_FIELD_LEN = 3000;
export { LIMIT_ROWS, LIMIT_FILE_BYTES };

export function parseDiaryCsv(raw: string): string[][] {
  if (raw.length > LIMIT_FILE_BYTES) throw new Error("CSVは2MB以下にしてください。");
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  const text = raw.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else if (!quoted && field.length === 0) quoted = true;
      else if (quoted) quoted = false;
      else throw new Error("CSVの引用符が不正です。");
    } else if (!quoted && (ch === "," || ch === "\n" || ch === "\r")) {
      row.push(field.slice(0, MAX_FIELD_LEN)); field = "";
      if (ch === ",") continue;
      if (ch === "\r" && text[i + 1] === "\n") i++;
      if (row.some(cell => cell.trim())) rows.push(row);
      row = [];
      if (rows.length > LIMIT_ROWS + 1) throw new Error("1,000件を超えるCSVは分割してください。");
    } else field += ch;
    if (field.length > MAX_FIELD_LEN) throw new Error("入力項目が長すぎます。");
  }
  if (quoted) throw new Error("CSVの引用符が閉じられていません。");
  row.push(field.slice(0, MAX_FIELD_LEN));
  if (row.some(cell => cell.trim())) rows.push(row);
  if (rows.length > LIMIT_ROWS + 1) throw new Error("1,000件を超えるCSVは分割してください。");
  return rows;
}

const canonical = (value: string) => value.replace(/[\s_\-－・()（）/]/g, "").toLowerCase();
const headers: Record<string, string[]> = {
  id: ["Netlify受付ID", "submissionid", "id", "number"],
  receivedAt: ["受付日", "受付日時", "createdat", "created_at", "date", "submittedat", "submitted_at"],
  restaurant: ["店舗・企業", "店舗・企業名", "店舗名", "restaurant_name", "company", "restaurant"],
  contact: ["担当者名", "ご担当者様", "contact_name", "name"],
  email: ["返信用メール", "返信先メールアドレス", "メールアドレス", "email"],
  service: ["PRプラン", "PRのご希望", "希望PRプラン", "service"],
  kind: ["受付区分", "申込み種別", "inquiry_kind"],
  message: ["相談内容", "相談・PR内容", "message"],
  featuredMenu: ["紹介メニュー", "featured_menu"],
  visitPreference: ["来店希望日", "来店候補日時", "visit_preference"],
  status: ["進捗ステータス", "status"],
  nextAction: ["次にやること", "next_action"],
  dueDate: ["対応期限", "due_date"],
  visitDate: ["来店予定日時", "visit_date"],
  postDate: ["投稿予定日", "post_date"],
  agreedFee: ["成約金額（税込）", "agreed_fee_yen"],
  paidAmount: ["入金済金額", "paid_amount_yen"],
  note: ["運用メモ", "note"],
  postUrl: ["Instagram投稿URL", "post_url"],
};

const aliases: Record<string, string> = Object.fromEntries(
  Object.entries(headers).flatMap(([key, candidates]) => candidates.map(candidate => [canonical(candidate), key]))
);

const trim = (value: string | undefined, limit = 2000): string => (value ?? "").trim().slice(0, limit);
const number = (value: string | undefined): number => {
  const normalized = String(value ?? "").replace(/[¥,\s]/g, "");
  const n = Number(normalized);
  return Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000_000 ? n : 0;
};
const normalizeStatus = (v: string): DiaryOpsStatus =>
  DIARY_OPS_STATUSES.includes(v as DiaryOpsStatus) ? v as DiaryOpsStatus : "未対応";

export function casesFromDiaryCsv(source: string): DiaryOpsCase[] {
  const [row0, ...rows] = parseDiaryCsv(source);
  if (!row0) throw new Error("CSVにデータがありません。");
  const index: Record<string, number> = {};
  row0.forEach((name, i) => {
    const key = aliases[canonical(name)];
    if (key && index[key] === undefined) index[key] = i;
  });
  if (index.restaurant === undefined || index.email === undefined) {
    throw new Error("「restaurant_name/店舗名」と「email/メールアドレス」列が必要です。Netlify FormsのCSVを書き出してください。");
  }
  const value = (row: string[], field: string) => trim(row[index[field]]);
  const result: DiaryOpsCase[] = [];
  const unique = new Set<string>();
  for (const row of rows) {
    const restaurant = value(row, "restaurant").slice(0, 120);
    const email = value(row, "email").slice(0, 254);
    if (!restaurant && !email) continue;
    const sourceId = value(row, "id").slice(0, 128);
    const id = sourceId || "local-" + String(result.length + 1);
    if (unique.has(id)) continue;
    unique.add(id);
    result.push({
      id,
      receivedAt: value(row, "receivedAt"),
      restaurant: restaurant || "名称未入力",
      contact: value(row, "contact").slice(0, 100),
      email,
      service: value(row, "service").slice(0, 100),
      kind: value(row, "kind").slice(0, 40),
      message: value(row, "message"),
      featuredMenu: value(row, "featuredMenu").slice(0, 500),
      visitPreference: value(row, "visitPreference").slice(0, 600),
      status: normalizeStatus(value(row, "status")),
      nextAction: value(row, "nextAction").slice(0, 500),
      dueDate: value(row, "dueDate").slice(0, 32),
      visitDate: value(row, "visitDate").slice(0, 32),
      postDate: value(row, "postDate").slice(0, 32),
      agreedFee: number(value(row, "agreedFee")),
      paidAmount: number(value(row, "paidAmount")),
      note: value(row, "note"),
      postUrl: /^https:\/\/(www\.)?instagram\.com\//.test(value(row, "postUrl")) ? value(row, "postUrl") : "",
    });
  }
  return result;
}

const csvCell = (value: unknown): string => {
  const string = String(value ?? "").replace(/\u0000/g, "");
  const safe = /^\s*[=+\-@\t\r]/.test(string) ? "'" + string : string;
  return '"' + safe.replace(/"/g, '""') + '"';
};

export function diaryOpsExportCsv(items: DiaryOpsCase[]): string {
  const fields: Array<[string, keyof DiaryOpsCase]> = [
    ["Netlify受付ID", "id"], ["受付日時", "receivedAt"], ["店舗・企業名", "restaurant"],
    ["担当者名", "contact"], ["メールアドレス", "email"], ["PRプラン", "service"],
    ["申込み種別", "kind"], ["相談内容", "message"], ["紹介メニュー", "featuredMenu"],
    ["来店希望日", "visitPreference"], ["進捗ステータス", "status"], ["次にやること", "nextAction"],
    ["対応期限", "dueDate"], ["来店予定日時", "visitDate"], ["投稿予定日", "postDate"],
    ["成約金額（税込）", "agreedFee"], ["入金済金額", "paidAmount"], ["運用メモ", "note"],
    ["Instagram投稿URL", "postUrl"],
  ];
  return "\uFEFF" + [
    fields.map(([label]) => csvCell(label)).join(","),
    ...items.map(row => fields.map(([, key]) => csvCell(row[key])).join(",")),
  ].join("\r\n");
}
