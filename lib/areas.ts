// Service areas. Matching and track records are judged per prefecture
// (大阪・兵庫). Neighbourhood names are only used to work out which
// prefecture a post or restaurant belongs to.

export const SERVICE_PREFECTURES = ["大阪", "兵庫"] as const;
export type ServicePrefecture = (typeof SERVICE_PREFECTURES)[number];

const places: Record<ServicePrefecture, string[]> = {
  大阪: [
    "大阪", "梅田", "北新地", "中之島", "福島", "天満", "南森町", "中崎町", "曽根崎", "茶屋町", "扇町",
    "難波", "なんば", "心斎橋", "道頓堀", "日本橋", "千日前", "堀江", "アメリカ村", "四ツ橋", "法善寺",
    "本町", "堺筋本町", "北浜", "淀屋橋", "谷町", "天満橋", "肥後橋", "靭公園",
    "天王寺", "阿倍野", "あべの", "新世界", "寺田町", "昭和町", "動物園前",
    "京橋", "鶴橋", "東大阪", "布施", "森ノ宮", "玉造", "桃谷", "今里",
    "豊中", "吹田", "江坂", "千里", "箕面", "小野原", "池田", "茨木", "高槻", "摂津", "緑地公園",
    "堺", "松原", "岸和田", "和泉", "藤井寺", "羽曳野", "富田林", "泉佐野", "八尾", "枚方", "寝屋川", "守口", "門真",
  ],
  兵庫: [
    "兵庫", "神戸", "三宮", "元町", "北野", "垂水", "須磨", "西宮", "尼崎", "芦屋", "宝塚", "伊丹", "川西",
    "明石", "姫路", "加古川", "淡路", "淡路市", "南淡路", "洲本", "有馬",
  ],
};

export function normalizeArea(value: string) {
  return value.normalize("NFKC").replace(/[\s　・]/g, "").trim();
}

/**
 * 大阪 / 兵庫 for any place in the service area, null otherwise.
 * The longest matching place name wins ("大阪市北区梅田" → 大阪).
 */
export function prefectureOf(area: string): ServicePrefecture | null {
  const value = normalizeArea(area);
  if (!value) return null;

  let best: { prefecture: ServicePrefecture; length: number } | null = null;
  for (const prefecture of SERVICE_PREFECTURES) {
    for (const place of places[prefecture]) {
      if (value.includes(place) && (!best || place.length > best.length)) {
        best = { prefecture, length: place.length };
      }
    }
  }
  return best?.prefecture ?? null;
}

export function isServiceArea(area: string) {
  return prefectureOf(area) !== null;
}
