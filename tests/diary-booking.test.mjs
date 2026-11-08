import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  makeBookingToken, bookingTokenHash, parseVisitDate, sevenDaysAfter,
} from "../lib/diary/booking.ts";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("booking tokens are unpredictable, hashed, length checked and single-use on server", () => {
  const a = makeBookingToken(), b = makeBookingToken();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
  assert.match(bookingTokenHash(a), /^[0-9a-f]{64}$/);
  assert.notEqual(bookingTokenHash(a), a);
  assert.equal(bookingTokenHash("bad"), null);
  const action = read("app/diary/confirm/[token]/actions.ts");
  assert.match(action, /\.gt\("proposal_expires_at", now\)/);
  assert.match(action, /proposal_token_hash: null/);
  assert.match(action, /\.eq\("compliance_status", "approved"\)/);
});
test("JST booking datetime is parsed, validated and not in the past", () => {
  const now = Date.parse("2026-10-16T00:00:00Z");
  assert.equal(parseVisitDate("2026-11-04T18:30", now), "2026-11-04T09:30:00.000Z");
  assert.equal(parseVisitDate("2026-02-31T18:30", now), null);
  assert.equal(parseVisitDate("2026-10-15T18:30", now), null);
  assert.equal(parseVisitDate("2026-11-04T25:30", now), null);
});
test("payment deadline occurs exactly seven days after publication", () => {
  assert.equal(sevenDaysAfter("2026-11-04T09:30:00.000Z"), "2026-11-11T09:30:00.000Z");
});
test("inquiry kind, human approval and payment tracking are persisted on isolated table", () => {
  const migration = read("supabase/migrations/202610160003_diary_first_party_booking.sql");
  const form = read("app/diary/components/inquiry-form.tsx");
  const action = read("app/admin/diary-inquiries/actions.ts");
  assert.match(migration, /inquiry_kind text/);
  assert.match(migration, /operator_notify_state/);
  assert.match(migration, /diary_no_overlapping_confirmed_visits/);
  assert.match(migration, /diary_booked_requires_confirmed_proposal/);
  assert.match(form, /name="inquiry_kind"/);
  assert.match(form, /name="desired_coverage"/);
  assert.match(form, /name="visit_preference"/);
  assert.match(action, /proposeDiaryVisit/);
  assert.match(action, /markDiaryPostPublished/);
  assert.match(action, /markDiaryPaymentReceived/);
  assert.match(action, /"after_publish_7d"/);
  assert.match(action, /Use a confirmed, single-use enterprise booking link/);
});
