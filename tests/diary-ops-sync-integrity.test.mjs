import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hasCompleteOpsSnapshot } from "../lib/diary/ops-sync-integrity.ts";

test("Netlify and Sheets must have the same unique submission IDs", () => {
  assert.equal(hasCompleteOpsSnapshot([], [], false), true);
  assert.equal(hasCompleteOpsSnapshot(["A", "B"], ["B", "A"], false), true);
  assert.equal(hasCompleteOpsSnapshot(["A", "B"], ["A"], false), false);
  assert.equal(hasCompleteOpsSnapshot(["A"], ["A", "extra"], false), false);
  assert.equal(hasCompleteOpsSnapshot(["A", "A"], ["A", "B"], false), false);
  assert.equal(hasCompleteOpsSnapshot(["A", "B"], ["A", "A"], false), false);
  assert.equal(hasCompleteOpsSnapshot(["A"], ["A"], true), false);
});

test("owner console blocks stale financial summaries and saves", () => {
  const source = readFileSync("app/diary/ops/components/diary-ops-console.tsx", "utf8");
  assert.match(source, /hasCompleteOpsSnapshot\(/);
  assert.match(source, /persisted.size !== records.length/);
  assert.match(source, /stateVersions.current.clear\(\);\s*setLiveError\("ネットワークエラー/);
  assert.match(source, /表示中の受付件数/);
  assert.match(source, /金額集計と保存を停止/);
});
