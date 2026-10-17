// Runs on Netlify's schedule only for published production deployments.
// CRON_SECRET is a Netlify runtime secret, never committed to source control.
export default async () => {
  const secret = process.env.CRON_SECRET;
  const site = process.env.URL;
  if (!secret || !site) {
    console.warn("Diary reconciler skipped: NETLIFY URL or CRON_SECRET missing");
    return;
  }

  let endpoint;
  try {
    const origin = new URL(site);
    if (origin.protocol !== "https:" || origin.username || origin.password) {
      throw new Error("Invalid production site origin");
    }
    endpoint = new URL("/api/cron/email", origin).toString();
  } catch {
    throw new Error("Invalid Netlify site URL");
  }

  const response = await fetch(endpoint, {
    headers: { Authorization: "Bearer " + secret },
    cache: "no-store",
    signal: AbortSignal.timeout(27000),
  });
  if (!response.ok) {
    throw new Error("Diary reconciliation failed (HTTP " + response.status + ")");
  }
};

export const config = { schedule: "5 * * * *" };
