export const CURRENT_POLICY_VERSION = "2026-10-13-alpha1";

export const REQUIRED_POLICIES = [
  "terms",
  "privacy",
  "pr_guidelines",
] as const;

export type RequiredPolicy = (typeof REQUIRED_POLICIES)[number];
