import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessDiaryLaunch } from "../scripts/diary-launch-readiness.mjs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("readiness is blocked for missing operator, notification and current metrics", () => {
  const audit = assessDiaryLaunch({});
  assert.equal(audit.codeConfigurationReady, false);
  assert.equal(audit.publicInquiryApproved, false);
  assert.equal(audit.paidMarketplaceApproved, false);
  for (const id of ["operator_name", "support_contact", "verified_followers", "intake"])
    assert.equal(audit.checks.find(c => c.id === id)?.ok, false);
});

test("even complete environment NEVER bypasses mandatory live and legal verification", () => {
  const good = {
    CONTEXT: "production", DIARY_SITE_MODE: "true", DIARY_NETLIFY_FORMS_ENABLED: "true",
    NEXT_PUBLIC_OPERATOR_NAME: "テスト運営者", NEXT_PUBLIC_SUPPORT_EMAIL: "demo@example.test",
    DIARY_VERIFIED_FOLLOWERS: "8000", DIARY_FOLLOWERS_VERIFIED_AT: "2026-10-22",
  };
  const audit = assessDiaryLaunch(good, new Date("2026-10-22T09:00:00Z"));
  assert.equal(audit.codeConfigurationReady, true);
  assert.equal(audit.publicInquiryApproved, false);
  assert.equal(audit.paidMarketplaceApproved, false);
  assert.ok(audit.manualApprovalRequired.length >= 5);
  const stale = assessDiaryLaunch({ ...good, DIARY_FOLLOWERS_VERIFIED_AT: "2026-01-01" },
    new Date("2026-10-22T09:00:00Z"));
  assert.equal(stale.codeConfigurationReady, false);
});

test("form options use the same verified server quote as the landing page", () => {
  const request = read("app/diary/request/page.tsx");
  const wrapper = read("app/diary/components/inquiry-form.tsx");
  const netlify = read("app/diary/components/netlify-inquiry-form.tsx");
  assert.match(request, /photoFeedPriceYen=\{price.amountYen\}/);
  assert.match(wrapper, /photoFeedPriceYen=\{photoFeedPriceYen\}/);
  assert.match(netlify, /photoFeedPriceYen.toLocaleString/);
  assert.match(netlify, /videoPackageStartYen.toLocaleString/);
  assert.doesNotMatch(netlify, /8,000円|15,000円/);
});

test("billing and unsupported performance claims fail closed", () => {
  const legal = read("app/legal/operator/page.tsx");
  const home = read("app/diary/page.tsx");
  const config = read("next.config.ts");
  assert.match(legal, /stripeReady \?/);
  assert.match(legal, /支払い方法と請求書の発行方法は、契約時に個別に確認します/);
  assert.match(home, /DIARY_METRICS_VERIFIED === "true"/);
  assert.match(config, /DIARY_SITE_MODE: process.env.CONTEXT === "production"/);
});
