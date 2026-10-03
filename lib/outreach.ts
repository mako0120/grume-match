// Sales email a Creator sends from their own Gmail ("ご依頼はこちらから").
// No email API: the app opens Gmail's compose window pre-filled.

export type OutreachInput = {
  creatorName: string;
  companyName: string;
  contactName?: string;
  price: number;
  orderUrl: string;
  /** Highlights from the 30-day summary, e.g. "直近30日の8投稿で合計約12.4万閲覧". */
  highlights: string[];
  verified: boolean;
};

export function buildOutreachEmail(input: OutreachInput) {
  const price = `¥${input.price.toLocaleString("ja-JP")}`;
  const greeting = input.contactName
    ? `${input.companyName}\n${input.contactName}様`
    : `${input.companyName} ご担当者様`;

  const proof = input.highlights.length
    ? [
        `直近の実績${input.verified ? "（運営確認済み）" : ""}：`,
        ...input.highlights.slice(0, 4).map((line) => `・${line}`),
        "",
      ]
    : [];

  const subject = `【${input.creatorName}】${input.companyName}様 PRのご提案（一律${price}・税込）`;
  const body = [
    greeting,
    "",
    `はじめまして。大阪を中心にグルメ情報を発信している「${input.creatorName}」です。`,
    `${input.companyName}様をInstagramでご紹介させていただきたく、ご連絡しました。`,
    "",
    ...proof,
    "■ プラン",
    `・一律${price}（税込）でInstagramリール1本を投稿`,
    "・お食事は1名分のみご提供ください",
    "・追加料金や価格交渉はありません",
    "",
    "■ ご依頼はこちらから",
    input.orderUrl,
    "",
    "来店できる日時を選ぶだけでご依頼いただけます。日程調整・投稿の確認まで、DMのやり取りなしで進みます。",
    "",
    "ご検討いただけましたら幸いです。",
    input.creatorName,
  ].join("\n");

  return { subject, body };
}

export function gmailComposeUrl(to: string, subject: string, body: string) {
  const params = new URLSearchParams({ view: "cm", fs: "1", su: subject, body });
  if (to) params.set("to", to);
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export function isEmail(value: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) && value.length <= 200;
}
