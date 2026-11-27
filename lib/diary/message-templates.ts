// One-tap starters for the "ご相談内容" field. Stores tap one, then rewrite
// the parts in （　）. Keep every body accepted by detectProhibitedPRRequest
// and within the shortest message field (600 characters, Gmail draft form).

export type DiaryMessageTemplate = {
  key: string;
  label: string;
  body: string;
};

export const DIARY_MESSAGE_TEMPLATES: readonly DiaryMessageTemplate[] = [
  {
    key: "new_menu",
    label: "新メニューを紹介したい",
    body: [
      "新しいメニューをInstagramで紹介していただきたいです。",
      "・紹介したいメニュー：（例：季節限定ランチ）",
      "・提供開始日：（例：12月1日から）",
      "・伝えたいポイント：（例：旬の食材、ボリューム）",
      "料金と、来店いただける日程を教えてください。",
    ].join("\n"),
  },
  {
    key: "first_visit",
    label: "初めての方に知ってほしい",
    body: [
      "まだお店を知らない方に、来店のきっかけを作りたいです。",
      "・お店の特徴：（例：駅から徒歩3分、カウンター席あり）",
      "・人気のメニュー：（例：看板の焼き鳥盛り合わせ）",
      "・来てほしいお客様：（例：仕事帰りの20〜30代）",
      "どのような投稿がよいか、ご提案いただけますか。",
    ].join("\n"),
  },
  {
    key: "story",
    label: "こだわりを伝えたい",
    body: [
      "料理やお店のこだわりを、写真と文章で丁寧に伝えていただきたいです。",
      "・こだわり：（例：毎朝仕入れる鮮魚、炭火焼き）",
      "・お店の雰囲気：（例：落ち着いた照明の個室）",
      "撮影の内容と料金について相談させてください。",
    ].join("\n"),
  },
  {
    key: "video",
    label: "動画もお願いしたい",
    body: [
      "写真に加えて、ショート動画での紹介もお願いしたいです。",
      "・撮ってほしい場面：（例：調理の様子、料理を取り分ける瞬間）",
      "・動画の使い方：（例：Instagramの投稿のみ／お店のSNSでも使いたい）",
      "動画を含めた料金と、納品までの流れを教えてください。",
    ].join("\n"),
  },
  {
    key: "price_question",
    label: "まず料金・流れを聞きたい",
    body: [
      "まだ内容は決まっていませんが、PRのご依頼を検討しています。",
      "料金、撮影から投稿までの流れ、来店いただける日程の目安を教えてください。",
      "・お店の場所：（例：大阪市北区）",
    ].join("\n"),
  },
];

/** Range of the first （…） blank, so the store can type over it right away. */
export function firstBlankRange(body: string): [number, number] | null {
  const start = body.indexOf("（");
  if (start < 0) return null;
  const end = body.indexOf("）", start);
  return end < 0 ? null : [start, end + 1];
}

/** True when the field holds the store's own writing (not empty, not a template). */
export function hasOwnText(value: string): boolean {
  const trimmed = value.trim();
  return trimmed !== "" && !DIARY_MESSAGE_TEMPLATES.some((template) => template.body === value);
}
