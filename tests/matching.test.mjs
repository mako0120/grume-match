import assert from "node:assert/strict";
import test from "node:test";
import { areaRelation, prefectureOf, regionOf } from "../lib/areas.ts";
import { parseInsightLines, summarizePerformance } from "../lib/creator-performance.ts";
import { autoInviteCandidates, matchCreatorToCampaign, rankCreators } from "../lib/matching.ts";

const MEASURED_ON = "2026-10-03";

function performance(text) {
  const { rows } = parseInsightLines(text, MEASURED_ON);
  return summarizePerformance(
    rows.map((row) => ({ ...row, platform: "instagram", measuredOn: MEASURED_ON, verified: true })),
    { today: MEASURED_ON },
  );
}

const gourmetDiary = {
  id: "gd",
  displayName: "グルメ日誌",
  baseArea: "大阪",
  minReward: 6000,
  bio: "大阪の焼肉とカフェ",
  performance: performance(`
淡路市 / 刺身好きなら一度は行きたい / 2.7万 / 1,106 / 27 / 12 / 5 / 3週間
小野原 / 漁港直営の新鮮な海鮮定食を堪能 / 2.7万 / 666 / 10 / 6 / 13 / 4日
天王寺 / 開店から行列 人気の一杯 / 2.5万 / 775 / 4 / 7 / 18 / 2週間
難波 / 大和肉鶏・近江鴨 お造り七種盛り / 1.4万 / 602 / 0 / 8 / 17 / 2週間
南淡路 / とにかくボリューム満点 / 1.0万 / 809 / 4 / 6 / 9 / 3週間
松原 / 泡系豚骨 一度は食べたい / 9,786 / 728 / 1 / 4 / 2 / 3週間
本町 / 職人が握る本格鮨を気軽に / 5,975 / 634 / 3 / 4 / 0 / 2週間
北新地 / 旬を揃える天麩羅コース / 5,446 / 618 / 2 / 11 / 0 / 2週間
`),
  completedPrs: 3,
  noShows: 0,
};

const newcomer = {
  id: "new",
  displayName: "なにわ食べ歩き",
  baseArea: "京橋",
  minReward: 0,
  performance: null,
  completedPrs: 0,
  noShows: 0,
};

const pricey = {
  id: "pricey",
  displayName: "高単価さん",
  baseArea: "梅田",
  minReward: 20000,
  performance: null,
  completedPrs: 8,
  noShows: 0,
};

test("areas group neighbourhoods into regions and prefectures", () => {
  assert.equal(regionOf("大阪市北区梅田1-2-3")?.label, "キタ");
  assert.equal(regionOf("北新地")?.label, "キタ");
  assert.equal(regionOf("小野原")?.label, "北摂");
  assert.equal(regionOf("淡路市")?.label, "淡路島");
  assert.equal(regionOf("大阪"), null);
  assert.equal(prefectureOf("南淡路"), "兵庫");

  assert.equal(areaRelation("難波", "なんば"), "region");
  assert.equal(areaRelation("梅田", "大阪市北区梅田"), "same");
  assert.equal(areaRelation("北新地", "梅田"), "region");
  assert.equal(areaRelation("本町", "梅田"), "prefecture");
  assert.equal(areaRelation("大阪", "梅田"), "prefecture");
  assert.equal(areaRelation("淡路市", "梅田"), "none");
});

test("グルメ日誌 is a strong match for a 梅田 焼肉 campaign and says why", () => {
  const match = matchCreatorToCampaign(
    { area: "梅田", category: "焼肉", cashReward: 8000 },
    gourmetDiary,
  );

  assert.equal(match.blocked, false);
  assert.equal(match.label, "とても合う");
  assert.ok(match.score >= 70, String(match.score));
  assert.deepEqual(match.reasons, [
    "1投稿あたり中央値1.2万閲覧（確認済み）",
    "キタ（北新地）で投稿実績あり",
    "PR完了3件",
    "焼肉の発信あり",
  ]);
  assert.deepEqual(match.cautions, []);
});

test("same-area posts outrank region, base area and prefecture", () => {
  const campaign = (area) => ({ area, category: "", cashReward: 8000 });

  assert.equal(matchCreatorToCampaign(campaign("難波"), gourmetDiary).reasons[0], "難波で投稿実績あり");
  assert.match(matchCreatorToCampaign(campaign("心斎橋"), gourmetDiary).reasons.join(), /ミナミ（難波）/);
  assert.match(matchCreatorToCampaign(campaign("京都"), gourmetDiary).cautions.join(), /京都周辺の実績はまだありません/);
});

test("reward below the Creator's minimum blocks the match", () => {
  const match = matchCreatorToCampaign({ area: "梅田", category: "", cashReward: 8000 }, pricey);

  assert.equal(match.blocked, true);
  assert.equal(match.label, "");
  assert.equal(match.cautions[0], "希望報酬（¥20,000〜）に届きません");
});

test("no-shows cost points and two block recommendations", () => {
  const base = { area: "梅田", category: "", cashReward: 8000 };
  const one = matchCreatorToCampaign(base, { ...gourmetDiary, noShows: 1 });
  const two = matchCreatorToCampaign(base, { ...gourmetDiary, noShows: 2 });

  assert.ok(one.score < matchCreatorToCampaign(base, gourmetDiary).score);
  assert.ok(one.cautions.includes("無断キャンセル1件"));
  assert.equal(two.blocked, true);
});

test("FLASH favours Creators who turned on 今行ける", () => {
  const flash = { area: "京橋", category: "", cashReward: 5000, kind: "flash" };
  const off = matchCreatorToCampaign(flash, newcomer);
  const on = matchCreatorToCampaign(flash, { ...newcomer, standbyActive: true });

  assert.equal(on.score - off.score, 15);
  assert.equal(on.reasons[0], "今行けるがON");
});

test("ranking and auto-invite skip blocked and weak matches", () => {
  const campaign = { area: "梅田", category: "焼肉", cashReward: 8000 };
  const ranked = rankCreators(campaign, [newcomer, pricey, gourmetDiary]);

  assert.deepEqual(ranked.map(({ creator }) => creator.id), ["gd", "new", "pricey"]);
  assert.deepEqual(
    autoInviteCandidates(campaign, [newcomer, pricey, gourmetDiary]).map(({ creator }) => creator.id),
    ["gd"],
  );
});
