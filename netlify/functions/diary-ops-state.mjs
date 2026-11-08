// Optional signed bridge for the existing owner-approved operational Sheet.
// Disabled unless the owner explicitly configures Netlify + Apps Script.
// Netlify Identity is verified on EVERY request; customer data and signing
// credentials are never embedded in client code or logged.
import { createHmac, randomBytes } from "node:crypto";

const STATUSES = new Set([
  "未対応", "返信済", "見積・条件調整", "成約", "来店済",
  "制作中", "投稿済", "請求済", "入金済", "完了", "終了",
]);
const TEXT_LIMITS = {
  nextAction: 500, dueDate: 10, visitDate: 10, postDate: 10,
  note: 2000, postUrl: 300,
};
const HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};
const reply = (data, status) => new Response(JSON.stringify(data), { status, headers: HEADERS });

export function stateConfigured(env = process.env) {
  return env.CONTEXT === "production" &&
    env.DIARY_OPS_AUTO_SYNC_ENABLED === "true" &&
    env.DIARY_OPS_STATE_ENABLED === "true" &&
    typeof env.DIARY_OPS_OWNER_EMAIL === "string" &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(env.DIARY_OPS_OWNER_EMAIL) &&
    typeof env.URL === "string" && /^https:\/\//.test(env.URL) &&
    typeof env.DIARY_SHEETS_WEBAPP_URL === "string" &&
    /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,300}\/exec$/.test(env.DIARY_SHEETS_WEBAPP_URL) &&
    typeof env.DIARY_SHEETS_HMAC_SECRET === "string" &&
    env.DIARY_SHEETS_HMAC_SECRET.length >= 32;
}

export function validatePatch(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const keys = Object.keys(input);
  if (!keys.length || keys.some(key => !["status", "agreedFee", "paidAmount", ...Object.keys(TEXT_LIMITS)].includes(key))) return null;
  const patch = {};
  for (const key of keys) {
    const value = input[key];
    if (key === "status") {
      if (typeof value !== "string" || !STATUSES.has(value)) return null;
    } else if (key === "agreedFee" || key === "paidAmount") {
      if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000) return null;
    } else if (typeof value !== "string" || value.length > TEXT_LIMITS[key] ||
      (["dueDate", "visitDate", "postDate"].includes(key) && value !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(value))) {
      return null;
    } else if (key === "postUrl" && value &&
      !/^https:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[a-zA-Z0-9_-]+\/?(?:\?.*)?$/.test(value)) {
      return null;
    }
    patch[key] = value;
  }
  return patch;
}

export function signSheetRequest(action, payload, secret, now = Date.now(), nonce = randomBytes(16).toString("hex")) {
  const serialized = JSON.stringify(payload);
  const signed = action + "\n" + now + "\n" + nonce + "\n" + serialized;
  return {
    action, timestamp: now, nonce, payload,
    signature: createHmac("sha256", secret).update(signed, "utf8").digest("hex"),
  };
}

async function readSignedSheet(action, payload, env, fetcher) {
  const requestBody = JSON.stringify(signSheetRequest(action, payload, env.DIARY_SHEETS_HMAC_SECRET));
  let response = await fetcher(env.DIARY_SHEETS_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8", Accept: "application/json" },
    body: requestBody,
    cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(12000),
  });
  if ([301, 302, 303].includes(response.status)) {
    // Apps Script ContentService redirects to a controlled googleusercontent URL.
    // The second hop carries NO secret body or Authorization header.
    const redirect = new URL(response.headers.get("location") || "", env.DIARY_SHEETS_WEBAPP_URL);
    if (redirect.protocol !== "https:" ||
      redirect.hostname !== "script.googleusercontent.com" ||
      redirect.pathname !== "/macros/echo") throw Error("Untrusted redirect");
    response = await fetcher(redirect.toString(), {
      method: "GET", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12000),
    });
  }
  if (!response.ok) throw Error("Sheet unavailable");
  const raw = await response.text();
  if (raw.length > 1_000_000) throw Error("Sheet response too large");
  const data = JSON.parse(raw);
  if (!data || typeof data !== "object" || Array.isArray(data) || typeof data.ok !== "boolean") {
    throw Error("Invalid Sheet response");
  }
  return data;
}

export async function stateResponse(request, env = process.env, fetcher = fetch) {
  if (request.method !== "GET" && request.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  if (!stateConfigured(env)) return reply({ error: "state_not_configured" }, 503);
  const rawAuth = request.headers.get("authorization") || "";
  const identityToken = /^Bearer ([A-Za-z0-9._~+/-]{50,6000})$/.exec(rawAuth)?.[1];
  if (!identityToken) return reply({ error: "authentication_required" }, 401);

  let site;
  try {
    site = new URL(env.URL);
    if (site.username || site.password || site.search || site.hash ||
      (!/(?:^|\.)netlify\.app$/i.test(site.hostname) && site.hostname !== new URL(request.url).hostname)) {
      return reply({ error: "invalid_site_configuration" }, 503);
    }
  } catch { return reply({ error: "invalid_site_configuration" }, 503); }

  try {
    const identity = await fetcher(new URL("/.netlify/identity/user", site), {
      method: "GET",
      headers: { Authorization: "Bearer " + identityToken, Accept: "application/json" },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
    });
    if (!identity.ok) return reply({ error: "authentication_required" }, 401);
    const user = await identity.json();
    const roles = Array.isArray(user?.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (typeof user?.email !== "string" ||
      user.email.trim().toLowerCase() !== env.DIARY_OPS_OWNER_EMAIL.trim().toLowerCase() ||
      !roles.includes("admin")) return reply({ error: "forbidden" }, 403);

    let action = "list", payload = {};
    if (request.method === "POST") {
      const raw = await request.text();
      if (raw.length > 10000) return reply({ error: "payload_too_large" }, 413);
      let body;
      try { body = JSON.parse(raw); } catch { return reply({ error: "invalid_json" }, 400); }
      if (!body || typeof body !== "object" ||
        !/^[a-z0-9-]{8,128}$/i.test(String(body.id ?? "")) ||
        !/^[a-f0-9]{64}$/.test(String(body.expectedVersion ?? ""))) {
        return reply({ error: "invalid_case" }, 400);
      }
      const patch = validatePatch(body.patch);
      if (!patch) return reply({ error: "invalid_patch" }, 400);
      action = "update";
      payload = { id: String(body.id), expectedVersion: body.expectedVersion, patch };
    }
    const result = await readSignedSheet(action, payload, env, fetcher);
    if (!result.ok) {
      const codes = { conflict: 409, not_found: 404, invalid: 400, rate_limited: 429 };
      const code = typeof result.error === "string" ? result.error : "sheet_error";
      return reply({ error: Object.hasOwn(codes, code) ? code : "sheet_error" }, codes[code] ?? 502);
    }
    if (action === "list") {
      if (!Array.isArray(result.items) || result.items.length > 1000) throw Error("Invalid operations");
      return reply({ items: result.items, syncedAt: new Date().toISOString() }, 200);
    }
    if (!result.item || typeof result.item !== "object") throw Error("Invalid updated case");
    return reply({ item: result.item }, 200);
  } catch {
    return reply({ error: "state_unavailable" }, 502);
  }
}

export default async function handler(request) {
  return stateResponse(request);
}
