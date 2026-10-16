import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMERCIAL_LIMITS,
  validCompanions,
  validCreatorSlots,
  validPlatforms,
  validReward,
  validVisitDuration,
} from "../lib/commercial-limits.ts";

test("commercial numeric inputs are bounded", () => {
  assert.equal(validReward(6000), true);
  assert.equal(validReward(COMMERCIAL_LIMITS.cashRewardYen + 1), false);
  assert.equal(validCreatorSlots(1), true);
  assert.equal(validCreatorSlots(COMMERCIAL_LIMITS.creatorSlots + 1), false);
  assert.equal(validCompanions(0), true);
  assert.equal(validCompanions(COMMERCIAL_LIMITS.companions + 1), false);
  assert.equal(validVisitDuration(120), true);
  assert.equal(validVisitDuration(COMMERCIAL_LIMITS.visitDurationMinutes + 1), false);
});

test("campaign platforms are allowlisted", () => {
  assert.equal(validPlatforms(["instagram_reel"]), true);
  assert.equal(validPlatforms(["unknown_network"]), false);
  assert.equal(validPlatforms([]), false);
});
