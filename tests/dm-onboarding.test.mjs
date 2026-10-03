import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { creatorReplyTemplate, restaurantInviteTemplate } from "../lib/dm-templates.ts";
import { safeNextPath, safeRole, withNext } from "../lib/next-path.ts";

test("only known in-app paths are accepted as next", () => {
  assert.equal(safeNextPath("/c/gourmet_nisshi"), "/c/gourmet_nisshi");
  assert.equal(safeNextPath("/i/abcdefghij0123456789"), "/i/abcdefghij0123456789");
  assert.equal(
    safeNextPath("/restaurant/offers/new?creator=1d386a0e-26a0-403f-8048-e3d6ca92e304"),
    "/restaurant/offers/new?creator=1d386a0e-26a0-403f-8048-e3d6ca92e304",
  );
  for (const bad of ["https://evil.example", "//evil.example", "/c/../admin", "/admin", "/i/short", "javascript:alert(1)", null, 3]) {
    assert.equal(safeNextPath(bad), null, String(bad));
  }
  assert.equal(safeRole("restaurant"), "restaurant");
  assert.equal(safeRole("admin"), null);
});

test("next and role survive signup → onboarding", () => {
  assert.equal(withNext("/signup", "/c/abc", "restaurant"), "/signup?next=%2Fc%2Fabc&role=restaurant");
  assert.equal(withNext("/login?message=x", "/i/abcdefghij0123456789"), "/login?message=x&next=%2Fi%2Fabcdefghij0123456789");
  assert.equal(withNext("/onboarding", null), "/onboarding");
});

test("DM templates carry the link and the right offer", () => {
  const reply = creatorReplyTemplate({ displayName: "グルメ日誌", url: "https://x/c/gd" });
  assert.match(reply, /https:\/\/x\/c\/gd$/);
  assert.match(reply, /手数料無料/);

  const meal = restaurantInviteTemplate({ restaurantName: "焼肉 ひまわり", handle: "new_foodie", cashReward: 0, url: "https://x/i/t" });
  assert.match(meal, /^@new_foodie さん、焼肉 ひまわりです。/);
  assert.match(meal, /お食事のご招待/);
  const paid = restaurantInviteTemplate({ restaurantName: "A", handle: "b", cashReward: 8000, url: "u" });
  assert.match(paid, /お食事＋報酬¥8,000/);
});

test("public pages expose no contact details and are not indexed", async () => {
  const [migration, creatorPage, invitePage] = await Promise.all([
    readFile("supabase/migrations/202610030010_dm_onboarding.sql", "utf8"),
    readFile("app/c/[slug]/page.tsx", "utf8"),
    readFile("app/i/[token]/page.tsx", "utf8"),
  ]);
  const pageFn = migration.slice(
    migration.indexOf("create or replace function public.get_creator_request_page"),
    migration.indexOf("revoke all on function public.get_creator_request_page"),
  );
  assert.doesNotMatch(pageFn, /email|address|phone|handle|user_id\s*,/);
  assert.match(pageFn, /verified_at is not null/);
  assert.match(pageFn, /request_page_enabled/);

  const inviteFn = migration.slice(
    migration.indexOf("create or replace function public.get_offer_invite"),
    migration.indexOf("revoke all on function public.get_offer_invite"),
  );
  assert.doesNotMatch(inviteFn, /r\.address/);

  for (const page of [creatorPage, invitePage]) {
    assert.match(page, /robots: \{ index: false, follow: false \}/);
  }
});
