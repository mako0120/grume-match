import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  formatTermsVersion,
  isTermsVersion,
  missingOperatorEnv,
  OPERATOR_ENV_KEYS,
  readOperatorInfo,
  TERMS_VERSION,
} from "../lib/legal.ts";

const read = (path) => readFile(path, "utf8");

test("the terms version is a date the database accepts", () => {
  assert.ok(isTermsVersion(TERMS_VERSION));
  assert.equal(isTermsVersion("2026-10-06"), true);
  assert.equal(isTermsVersion("v1"), false);
  assert.equal(isTermsVersion(null), false);
  assert.equal(formatTermsVersion("2026-10-06"), "2026年10月6日");
});

test("operator details come only from the environment and blanks count as missing", () => {
  const empty = readOperatorInfo({});
  assert.deepEqual(Object.values(empty), [null, null, null, null, null]);
  assert.deepEqual(missingOperatorEnv({}), Object.values(OPERATOR_ENV_KEYS));

  const full = Object.fromEntries(Object.values(OPERATOR_ENV_KEYS).map((key) => [key, "x"]));
  assert.deepEqual(missingOperatorEnv(full), []);
  assert.deepEqual(missingOperatorEnv({ ...full, LEGAL_OPERATOR_PHONE: "   " }), ["LEGAL_OPERATOR_PHONE"]);
});

test("legal pages exist, are linked from every page and invent no operator data", async () => {
  const layout = await read("app/layout.tsx");
  const footer = await read("components/site-footer.tsx");
  assert.match(layout, /<SiteFooter \/>/);
  for (const href of ["/terms", "/privacy", "/legal"]) {
    assert.match(footer, new RegExp(`href="${href}"`));
  }

  for (const path of ["app/terms/page.tsx", "app/privacy/page.tsx", "app/legal/page.tsx"]) {
    const source = await read(path);
    assert.match(source, /readOperatorInfo\(\)/, path);
    assert.match(source, /force-dynamic/, path);
    // No hard-coded phone numbers or postal codes standing in for real data.
    assert.doesNotMatch(source, /\d{2,4}-\d{2,4}-\d{3,4}|〒\s*\d{3}-\d{4}/, path);
  }

  // Fee numbers on the legal pages follow lib/pricing.ts.
  for (const path of ["app/terms/page.tsx", "app/legal/page.tsx"]) {
    const source = await read(path);
    assert.match(source, /PLATFORM_FEE_RATE/, path);
    assert.match(source, /PLATFORM_FEE_MINIMUM/, path);
  }
});

test("signup requires consent and records it through the RPC", async () => {
  const page = await read("app/signup/page.tsx");
  const actions = await read("server/actions/auth.ts");

  assert.match(page, /name="agreeTerms" required type="checkbox" value=\{TERMS_VERSION\}/);
  assert.match(actions, /formData\.get\("agreeTerms"\) !== TERMS_VERSION/);
  assert.match(actions, /rpc\("accept_terms", \{ p_version: TERMS_VERSION \}\)/);
  // Consent is checked before an account is created.
  assert.ok(
    actions.indexOf('formData.get("agreeTerms")') < actions.indexOf("auth.signUp("),
    "consent must be checked before signUp",
  );
});

test("every signed-in path asks for consent before onboarding or the app", async () => {
  const requireRole = await read("server/auth/require-role.ts");
  const destination = await read("server/auth/resolve-destination.ts");
  const onboarding = await read("app/onboarding/page.tsx");

  assert.ok(
    requireRole.indexOf("hasAcceptedCurrentTerms") < requireRole.indexOf("onboarding_completed_at)"),
  );
  assert.match(requireRole, /redirect\("\/terms\/accept"\)/);
  assert.ok(
    destination.indexOf("hasAcceptedCurrentTerms(") < destination.indexOf("!userRow.onboarding_completed_at"),
  );
  assert.match(onboarding, /destination === "\/terms\/accept"/);

  const terms = await read("server/auth/terms.ts");
  assert.match(terms, /\.eq\("terms_version", TERMS_VERSION\)/);
  assert.match(terms, /return !error && Boolean\(data\)/);
});

test("post URLs are submitted only with a PR disclosure confirmation", async () => {
  const action = await read("server/actions/deliverables.ts");
  const page = await read("app/creator/bookings/[id]/page.tsx");
  const migration = await read("supabase/migrations/202610060001_terms_consent_pr_disclosure.sql");

  assert.match(page, /name="prDisclosed" required type="checkbox" value="yes"/);
  assert.match(action, /p_pr_disclosed: prDisclosed/);
  assert.match(action, /pr_disclosure_required/);
  assert.match(migration, /drop function if exists public\.submit_deliverable\(uuid, text\);/);
  assert.match(migration, /if p_pr_disclosed is not true then/);
});

test("health reports legal readiness by name only", async () => {
  const source = await read("app/api/health/route.ts");
  assert.match(source, /legal: legalStatus\(\)/);
  assert.doesNotMatch(source, /missingOperatorEnv\(\)\s*[,}]/);
  assert.doesNotMatch(source, /LEGAL_OPERATOR_[A-Z_]+/);
});

test("onboarding actions refuse to collect profile data before consent", async () => {
  const source = await read("server/actions/onboarding.ts");
  assert.equal(source.match(/hasAcceptedCurrentTerms\(supabase, authData\.user\.id\)/g)?.length, 2);
  for (const name of ["completeCreatorOnboarding", "completeRestaurantOnboarding"]) {
    const body = source.slice(source.indexOf(`function ${name}`));
    assert.ok(body.indexOf("hasAcceptedCurrentTerms") < body.indexOf(".rpc("), name);
  }
});
