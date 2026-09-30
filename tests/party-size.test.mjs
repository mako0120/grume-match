import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPartySizes,
  defaultPartySize,
  partySizeLabel,
} from "../lib/party-size.ts";

test("solo-only campaign exposes exactly one attendee option", () => {
  assert.deepEqual(buildPartySizes(0), [1]);
});

test("campaign with one optional companion still defaults to solo", () => {
  assert.deepEqual(buildPartySizes(1), [1, 2]);
  assert.equal(defaultPartySize(), 1);
});

test("solo attendee gets an explicit label", () => {
  assert.equal(partySizeLabel(1), "1名（ひとり）");
  assert.equal(partySizeLabel(2), "2名");
});
