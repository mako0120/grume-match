// Ready-to-paste DM texts that move a PR request from Instagram DMs onto
// GOURMET DIARY. Kept short: they are sent from a phone.

import { formatReward } from "./pricing.ts";

/** Creator → Restaurant, as a reply to a PR request received by DM. */
export function creatorReplyTemplate(input: { displayName: string; url: string }) {
  return [
    "PRのご依頼ありがとうございます！",
    `${input.displayName}のPRのご依頼は、こちらのページからお願いしています。`,
    "日程はタップで決まり、過去30日の閲覧実績もご確認いただけます（最初の1件は手数料無料です）。",
    input.url,
  ].join("\n");
}

/** Restaurant → Creator, with an invite link for one offer. */
export function restaurantInviteTemplate(input: {
  restaurantName: string;
  handle: string;
  cashReward: number;
  url: string;
}) {
  const reward = input.cashReward > 0 ? `お食事＋報酬${formatReward(input.cashReward)}` : "お食事のご招待";
  return [
    `@${input.handle} さん、${input.restaurantName}です。`,
    `PR投稿のご依頼です（${reward}）。`,
    "条件と候補日時はこちらから確認でき、行ける時間をタップするだけで応募できます。",
    input.url,
  ].join("\n");
}
