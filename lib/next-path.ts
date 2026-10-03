// Where to go back to after signing up / in, e.g. from a Creator's request
// page or an offer invite. Only same-site paths on an allow-list, so the
// parameter cannot be used as an open redirect.

const allowed = [/^\/c\/[a-z0-9_-]{3,30}$/, /^\/i\/[a-z0-9]{20}$/, /^\/restaurant\/offers\/new\?creator=[0-9a-f-]{36}$/];

export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (path.length > 120) return null;
  return allowed.some((pattern) => pattern.test(path)) ? path : null;
}

export type StartRole = "creator" | "restaurant";

export function safeRole(value: unknown): StartRole | null {
  return value === "creator" || value === "restaurant" ? value : null;
}

/** Query string carrying next/role through signup → onboarding. */
export function withNext(path: string, next: string | null, role?: StartRole | null) {
  const params = new URLSearchParams();
  if (next) params.set("next", next);
  if (role) params.set("role", role);
  const query = params.toString();
  if (!query) return path;
  return path + (path.includes("?") ? "&" : "?") + query;
}
