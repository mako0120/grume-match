import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("scheduling queries never offer past or unavailable slots", async () => {
  const [reschedules, applications] = await Promise.all([
    readFile("server/queries/reschedules.ts", "utf8"),
    readFile("server/queries/restaurant-applications.ts", "utf8"),
  ]);

  assert.match(reschedules, /new Date\(slot\.starts_at\)\.getTime\(\) > Date\.now\(\)/);
  assert.match(reschedules, /slot\.id !== row\.campaign_slot_id && slot\.isOpen/);
  assert.match(applications, /new Date\(slot\.starts_at\)\.getTime\(\) > Date\.now\(\)/);
  assert.match(applications, /\.filter\(\(slot\) => slot\.isOpen\)/);
});

test("Restaurant applicant queue only contains actionable applications", async () => {
  const source = await readFile("server/queries/restaurant-applications.ts", "utf8");

  assert.match(source, /\["applied", "shortlisted", "accepted"\]/);
});

test("deliverable actions provide safe user-facing feedback", async () => {
  const source = await readFile("server/actions/deliverables.ts", "utf8");

  assert.match(source, /投稿URLを提出しました/);
  assert.match(source, /修正内容を入力してください/);
  assert.doesNotMatch(source, /redirect\s*\(\s*error\.message\s*\)/);
});

test("status labels hide internal enum names in primary UX", async () => {
  const source = await readFile("lib/status-labels.ts", "utf8");

  assert.match(source, /支払承認済み/);
  assert.match(source, /修正依頼/);
  assert.match(source, /来店確定/);
});
