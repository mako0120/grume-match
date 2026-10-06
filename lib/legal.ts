// Legal texts and operator disclosure (特定商取引法に基づく表記).
//
// TERMS_VERSION is the effective date of the current 利用規約 / プライバシー
// ポリシー. Changing it asks every signed-in user to agree again.
export const TERMS_VERSION = "2026-10-06";

/** Operator details shown on /legal. Values come from the environment only. */
export const OPERATOR_ENV_KEYS = {
  name: "LEGAL_OPERATOR_NAME",
  representative: "LEGAL_OPERATOR_REPRESENTATIVE",
  address: "LEGAL_OPERATOR_ADDRESS",
  phone: "LEGAL_OPERATOR_PHONE",
  email: "LEGAL_CONTACT_EMAIL",
} as const;

export type OperatorField = keyof typeof OPERATOR_ENV_KEYS;

export type OperatorInfo = Record<OperatorField, string | null>;

type Env = Record<string, string | undefined>;

export function readOperatorInfo(env: Env = process.env): OperatorInfo {
  const info = {} as OperatorInfo;
  for (const [field, key] of Object.entries(OPERATOR_ENV_KEYS) as [OperatorField, string][]) {
    const value = env[key]?.trim();
    info[field] = value ? value : null;
  }
  return info;
}

/** Names (never values) of the operator variables that are still unset. */
export function missingOperatorEnv(env: Env = process.env) {
  const info = readOperatorInfo(env);
  return (Object.keys(OPERATOR_ENV_KEYS) as OperatorField[])
    .filter((field) => !info[field])
    .map((field) => OPERATOR_ENV_KEYS[field]);
}

export function isTermsVersion(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function formatTermsVersion(version: string = TERMS_VERSION) {
  const [year, month, day] = version.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}
