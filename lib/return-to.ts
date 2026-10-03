// Where to send a Restaurant after login / sign-up / onboarding when they
// started from a Creator's order page. Only order pages are allowed, so this
// can never become an open redirect.
export const RETURN_TO_COOKIE = "gd_return_to";

export function safeReturnTo(value: unknown): string | null {
  return typeof value === "string" && /^\/order\/[a-z0-9][a-z0-9-]{2,29}$/.test(value)
    ? value
    : null;
}
