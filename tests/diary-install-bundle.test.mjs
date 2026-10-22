import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  generateDiaryBundle, DIARY_BUNDLE_PATH, DIARY_GS_SOURCES,
} from "../scripts/build-diary-install-bundle.mjs";

test("single-paste Apps Script bundle exactly matches reviewed source files", () => {
  const bundle = readFileSync(DIARY_BUNDLE_PATH, "utf8");
  assert.equal(bundle, generateDiaryBundle());
  assert.equal(DIARY_GS_SOURCES.length, 3);
  for (const key of ["function syncDiaryNetlifyForms()", "function doPost(e)",
    "function checkDiaryIntegrationReadiness()", "function activateDiaryIntegration()"]) {
    assert.ok(bundle.includes(key), key);
  }
  assert.doesNotMatch(bundle, /-----BEGIN (PRIVATE|RSA) KEY-----/);
});

test("install bundle is parsable Apps Script JavaScript, without duplicate exports", () => {
  const bundle = readFileSync(DIARY_BUNDLE_PATH, "utf8");
  new vm.Script(bundle, { filename: "diary-ops-install-bundle.gs" });
  assert.equal((bundle.match(/function doPost\(e\)/g) || []).length, 1);
});
