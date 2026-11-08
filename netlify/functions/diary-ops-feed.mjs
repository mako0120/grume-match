// Read-only Netlify Forms ingestion for the dedicated owner console.
// Never expose the Netlify API token to the browser or return unfiltered raw submissions.
// All access is denied unless the owner has enabled auto sync, Netlify Identity has
// verified their access token, and the identity has the exact admin role + email.
const FORM_NAME = "diary-pr-inquiry";
const API_ORIGIN = "https://api.netlify.com";
const MAX_PAGES = 5;
const PER_PAGE = 100;

export const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Access-Control-Allow-Credentials": "false",
};

const json = (value, status) => new Response(JSON.stringify(value), { status, headers });
const text = (obj, key, n = 2000) =>
  typeof obj?.[key] === "string" ? obj[key].slice(0, n) : "";

export function configured(env = process.env) {
  return env.CONTEXT === "production" &&
    env.DIARY_OPS_AUTO_SYNC_ENABLED === "true" &&
    typeof env.DIARY_OPS_OWNER_EMAIL === "string" &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(env.DIARY_OPS_OWNER_EMAIL) &&
    typeof env.DIARY_NETLIFY_API_TOKEN === "string" &&
    env.DIARY_NETLIFY_API_TOKEN.length >= 16 &&
    typeof env.DIARY_NETLIFY_SITE_ID === "string" &&
    /^[a-z0-9-]{12,80}$/i.test(env.DIARY_NETLIFY_SITE_ID) &&
    typeof env.URL === "string" && env.URL.startsWith("https://");
}

export function normalizedLead(value) {
  if (!value || typeof value !== "object") return null;
  if (!/^[a-z0-9-]{8,128}$/i.test(String(value.id ?? ""))) return null;
  const fields = value.data && typeof value.data === "object" ? value.data : {};
  return {
    id: String(value.id),
    receivedAt: text(value, "created_at", 50),
    restaurant: text(fields, "restaurant_name", 120) || "名称未入力",
    contact: text(fields, "contact_name", 100),
    email: text(fields, "email", 254),
    service: text(fields, "service", 100),
    kind: text(fields, "inquiry_kind", 40),
    message: text(fields, "message", 2000),
    featuredMenu: text(fields, "featured_menu", 500),
    visitPreference: text(fields, "visit_preference", 600),
  };
}

function nextPageLink(header, formId) {
  const next = (header ?? "").split(",").find(part => /\brel="next"/.test(part));
  if (!next) return null;
  const match = /<([^<>]+)>/.exec(next);
  if (!match) return null;
  try {
    const url = new URL(match[1]);
    if (url.origin !== API_ORIGIN ||
      url.pathname !== "/api/v1/forms/" + formId + "/submissions" ||
      [...url.searchParams.keys()].some(key => !["page", "per_page"].includes(key))) {
      throw new Error("Netlify pagination URL rejected");
    }
    return url.toString();
  } catch {
    throw new Error("Untrusted Netlify pagination URL");
  }
}

async function getArray(url, bearer, fetcher) {
  const resp = await fetcher(url, {
    method: "GET",
    headers: { Authorization: "Bearer " + bearer, Accept: "application/json" },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error("Netlify API error");
  const data = await resp.json();
  if (!Array.isArray(data)) throw new Error("Invalid Netlify API response");
  return { data, link: resp.headers.get("link") };
}

export async function liveLeadResponse(request, env = process.env, fetcher = fetch) {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  if (!configured(env)) return json({ error: "not_configured" }, 503);
  const raw = request.headers.get("authorization") || "";
  const token = /^Bearer ([A-Za-z0-9._~+/-]{50,6000})$/.exec(raw)?.[1];
  if (!token) return json({ error: "authentication_required" }, 401);

  // Only the canonical production site is trusted for the Identity audience.
  const site = new URL(env.URL);
  if (site.username || site.password || site.search || site.hash ||
      !/^(?:[a-z0-9-]+\.)?netlify\.app$/i.test(site.hostname) &&
      site.hostname !== new URL(request.url).hostname) {
    return json({ error: "misconfigured_site_url" }, 503);
  }
  try {
    const identity = await fetcher(new URL("/.netlify/identity/user", site).toString(), {
      method: "GET",
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!identity.ok) return json({ error: "authentication_required" }, 401);
    const user = await identity.json();
    const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
    const roles = Array.isArray(user?.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (email !== env.DIARY_OPS_OWNER_EMAIL.trim().toLowerCase() || !roles.includes("admin")) {
      return json({ error: "forbidden" }, 403);
    }
    const siteId = encodeURIComponent(env.DIARY_NETLIFY_SITE_ID);
    const found = await getArray(API_ORIGIN + "/api/v1/sites/" + siteId + "/forms", env.DIARY_NETLIFY_API_TOKEN, fetcher);
    const matching = found.data.filter(x => x?.name === FORM_NAME && /^[a-z0-9-]{8,128}$/i.test(String(x?.id ?? "")));
    if (matching.length !== 1) return json({ error: "form_not_found" }, 502);

    const formId = matching[0].id;
    let url = API_ORIGIN + "/api/v1/forms/" + formId + "/submissions?page=1&per_page=" + PER_PAGE;
    const leads = new Map();
    let pages = 0;
    while (url && pages < MAX_PAGES) {
      const resp = await getArray(url, env.DIARY_NETLIFY_API_TOKEN, fetcher);
      for (const candidate of resp.data) {
        const row = normalizedLead(candidate);
        if (row && !leads.has(row.id)) leads.set(row.id, row);
      }
      pages++;
      url = nextPageLink(resp.link, formId);
    }
    return json({ leads: [...leads.values()], partial: Boolean(url), lastCheckedAt: new Date().toISOString() }, 200);
  } catch {
    // Never leak tokens, visitor information or upstream response bodies to the client.
    return json({ error: "upstream_unavailable" }, 502);
  }
}

export default async function handler(request) {
  return liveLeadResponse(request);
}
