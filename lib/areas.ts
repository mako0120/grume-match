// Kansai dining areas grouped the way people think about going out.
// Used to judge how close a Creator's track record is to a campaign.

type Region = { id: string; label: string; prefecture: string; areas: string[] };

export const regions: Region[] = [
  {
    id: "kita",
    label: "キタ",
    prefecture: "大阪",
    areas: ["梅田", "北新地", "中之島", "福島", "天満", "南森町", "中崎町", "西梅田", "東梅田", "曽根崎", "茶屋町", "扇町"],
  },
  {
    id: "minami",
    label: "ミナミ",
    prefecture: "大阪",
    areas: ["難波", "なんば", "心斎橋", "道頓堀", "日本橋", "千日前", "堀江", "アメリカ村", "四ツ橋", "法善寺", "裏なんば"],
  },
  {
    id: "honmachi",
    label: "本町・淀屋橋",
    prefecture: "大阪",
    areas: ["本町", "堺筋本町", "北浜", "淀屋橋", "谷町", "天満橋", "肥後橋", "靭公園", "西本町"],
  },
  {
    id: "tennoji",
    label: "天王寺・阿倍野",
    prefecture: "大阪",
    areas: ["天王寺", "阿倍野", "あべの", "新世界", "寺田町", "昭和町", "動物園前"],
  },
  {
    id: "east",
    label: "京橋・鶴橋・東大阪",
    prefecture: "大阪",
    areas: ["京橋", "鶴橋", "東大阪", "布施", "森ノ宮", "玉造", "桃谷", "今里"],
  },
  {
    id: "hokusetsu",
    label: "北摂",
    prefecture: "大阪",
    areas: ["豊中", "吹田", "江坂", "千里", "箕面", "小野原", "池田", "茨木", "高槻", "摂津", "緑地公園"],
  },
  {
    id: "south",
    label: "南大阪",
    prefecture: "大阪",
    areas: ["堺", "松原", "岸和田", "和泉", "藤井寺", "羽曳野", "富田林", "泉佐野", "八尾"],
  },
  {
    id: "awaji",
    label: "淡路島",
    prefecture: "兵庫",
    areas: ["淡路", "淡路市", "南淡路", "洲本"],
  },
  {
    id: "kobe",
    label: "神戸・阪神",
    prefecture: "兵庫",
    areas: ["神戸", "三宮", "元町", "西宮", "尼崎", "芦屋", "宝塚", "伊丹"],
  },
  {
    id: "kyoto",
    label: "京都",
    prefecture: "京都",
    areas: ["京都", "河原町", "祇園", "烏丸", "四条", "嵐山", "伏見"],
  },
];

const prefectures = ["大阪", "兵庫", "京都", "奈良", "和歌山", "滋賀"];

export function normalizeArea(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\s　・]/g, "")
    .replace(/(府|県|市|区|駅|エリア|周辺)$/u, "")
    .trim();
}

function includesEither(a: string, b: string) {
  return a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a));
}

export function regionOf(area: string): Region | null {
  const value = normalizeArea(area);
  if (!value) return null;

  let best: { region: Region; length: number } | null = null;
  for (const region of regions) {
    for (const name of region.areas) {
      const normalized = normalizeArea(name);
      // "大阪市北区梅田" → 梅田. A bare "大阪" is not any one region.
      if (value.includes(normalized) && (!best || normalized.length > best.length)) {
        best = { region, length: normalized.length };
      }
    }
  }
  return best?.region ?? null;
}

export function prefectureOf(area: string) {
  const value = normalizeArea(area);
  const direct = prefectures.find((name) => value.includes(name));
  return direct ?? regionOf(area)?.prefecture ?? null;
}

export type AreaRelation = "same" | "region" | "prefecture" | "none";

/** How close area `a` is to area `b`. */
export function areaRelation(a: string, b: string): AreaRelation {
  const left = normalizeArea(a);
  const right = normalizeArea(b);
  if (!left || !right) return "none";

  // A bare prefecture ("大阪") is never the "same area" as a neighbourhood.
  const leftIsPrefecture = prefectures.includes(left);
  const rightIsPrefecture = prefectures.includes(right);
  if (leftIsPrefecture || rightIsPrefecture) {
    return prefectureOf(a) && prefectureOf(a) === prefectureOf(b) ? "prefecture" : "none";
  }

  if (includesEither(left, right)) return "same";

  const leftRegion = regionOf(a);
  const rightRegion = regionOf(b);
  if (leftRegion && rightRegion && leftRegion.id === rightRegion.id) return "region";

  const leftPrefecture = prefectureOf(a);
  if (leftPrefecture && leftPrefecture === prefectureOf(b)) return "prefecture";

  return "none";
}
