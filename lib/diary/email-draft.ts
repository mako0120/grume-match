/** Public contact address. No login, email-provider token, or server-side send is used. */
export const DIARY_PR_EMAIL = "23610083grume1@gmail.com";

const SERVICE_NAMES: Record<string, string> = {
  instagram_feed: "Instagram写真フィード1投稿",
  instagram_feed_video: "写真フィード＋ショート動画",
  instagram_reel: "Instagramリール（見積もり）",
  instagram_stories: "Instagramストーリーズ（見積もり）",
  photo_video: "写真・動画素材（見積もり）",
  consultation: "相談して決めたい",
};

export type DiaryEmailDraft = {
  subject: string;
  body: string;
  gmailUrl: string;
  mailtoUrl: string;
};

export type DiaryEmailDraftInput = {
  restaurant: string;
  contact: string;
  replyTo: string;
  service: string;
  message: string;
  coverage?: string;
  menu?: string;
  visitPreference?: string;
};

function cleanMailText(value: string | undefined, max: number): string {
  return (value ?? "").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, " ").trim().slice(0, max);
}

export function diaryEmailDraft(subject: string, body: string): DiaryEmailDraft {
  const safeSubject = cleanMailText(subject, 150);
  const safeBody = cleanMailText(body, 2200);
  const encodedSubject = encodeURIComponent(safeSubject);
  const encodedBody = encodeURIComponent(safeBody);
  return {
    subject: safeSubject,
    body: safeBody,
    gmailUrl: "https://mail.google.com/mail/?view=cm&fs=1&to=" +
      encodeURIComponent(DIARY_PR_EMAIL) + "&su=" + encodedSubject + "&body=" + encodedBody,
    mailtoUrl: "mailto:" + DIARY_PR_EMAIL +
      "?subject=" + encodedSubject + "&body=" + encodedBody,
  };
}

export function buildDiaryApplicationEmail(input: DiaryEmailDraftInput): DiaryEmailDraft {
  const restaurant = cleanMailText(input.restaurant, 100);
  const lines = [
    "グルメ日誌 ご担当者様",
    "",
    "Instagram PRについて、以下の内容でご相談します。",
    "",
    "【店舗・企業名】" + restaurant,
    "【ご担当者名】" + cleanMailText(input.contact, 80),
    "【返信先メール】" + cleanMailText(input.replyTo, 254),
    "【希望PR】" + (SERVICE_NAMES[input.service] ?? "個別相談"),
    "【PRで伝えたい点】" + cleanMailText(input.coverage, 320),
    "【紹介メニュー】" + (cleanMailText(input.menu, 190) || "未定"),
    "【来店候補日時】" + (cleanMailText(input.visitPreference, 190) || "相談して決めたい"),
    "【ご依頼内容】" + cleanMailText(input.message, 600),
    "",
    "※正式な契約は制作内容・料金・日程について双方で合意してから確定します。",
  ];
  return diaryEmailDraft("【グルメ日誌】PRのお申込み相談：" + restaurant, lines.join("\n"));
}

export function buildDiaryConsultationEmail(): DiaryEmailDraft {
  return diaryEmailDraft(
    "【グルメ日誌】PRについてのご相談",
    "グルメ日誌 ご担当者様\n\nInstagram PRについて相談したいです。\n\n【店舗名】\n【ご担当者名】\n【相談内容】\n\nよろしくお願いいたします。",
  );
}
