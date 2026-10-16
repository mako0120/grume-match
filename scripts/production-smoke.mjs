#!/usr/bin/env node

const baseUrl = (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "")
  .replace(/\/$/, "");

if (!baseUrl || !baseUrl.startsWith("https://")) {
  console.error("SITE_URL or NEXT_PUBLIC_SITE_URL must be an HTTPS URL.");
  process.exit(1);
}

async function fetchJson(path) {
  const response = await fetch(baseUrl + path, {
    redirect: "manual",
    headers: {
      "user-agent": "gourmet-diary-production-smoke/1.0",
    },
  });

  const text = await response.text();
  let body = null;

  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return {
    path,
    status: response.status,
    location: response.headers.get("location"),
    body,
  };
}

const paths = [
  "/api/health",
  "/api/readiness",
  "/login",
  "/signup",
  "/forgot-password",
  "/legal/terms",
  "/legal/privacy",
  "/legal/pr-guidelines",
  "/support",
];

const checks = [];
for (const path of paths) checks.push(await fetchJson(path));

let failed = false;

for (const check of checks) {
  const isJsonEndpoint = check.path.startsWith("/api/");
  const expected =
    check.path === "/api/health"
      ? check.status === 200 && check.body?.database === "ok"
      : check.path === "/api/readiness"
        ? [200, 503].includes(check.status) &&
          typeof check.body === "object" &&
          check.body !== null
        : [200, 307, 308].includes(check.status);

  if (!expected) failed = true;

  console.log(
    JSON.stringify({
      path: check.path,
      status: check.status,
      ok: expected,
      location: check.location,
      summary: isJsonEndpoint ? check.body : undefined,
    }),
  );
}

if (failed) {
  console.error("Production smoke test failed.");
  process.exit(1);
}

console.log("Production smoke test passed.");