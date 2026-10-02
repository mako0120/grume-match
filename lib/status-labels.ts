export const paymentStatusLabels: Record<string, string> = {
  pending: "確認待ち",
  approved: "支払承認済み",
  scheduled: "振込予定",
  paid: "支払済み",
  failed: "要確認",
};

export const verificationStatusLabels: Record<string, string> = {
  pending: "確認待ち",
  approved: "承認済み",
  rejected: "修正依頼",
};

export const notificationTypeLabels: Record<string, string> = {
  application_received: "応募",
  application_rejected: "募集結果",
  application_withdrawn: "応募",
  booking_confirmed: "来店確定",
  reschedule_requested: "日時変更",
  reschedule_approved: "日時変更",
  reschedule_rejected: "日時変更",
  deliverable_submitted: "投稿提出",
  deliverable_approved: "投稿確認",
  deliverable_revision_requested: "投稿確認",
  payment_approved: "報酬",
  payment_scheduled: "報酬",
  payment_paid: "報酬",
  payment_failed: "報酬",
  visit_reminder_24h: "来店予定",
  deliverable_due_24h: "投稿期限",
  flash_for_standby: "FLASH",
  direct_offer_received: "指名",
  usage_license_expiring: "素材利用",
};


export const campaignStatusLabels: Record<string, string> = {
  draft: "下書き",
  published: "公開中",
  recruiting: "募集中",
  closed: "募集終了",
  filled: "募集完了",
  in_progress: "進行中",
  completed: "完了",
  cancelled: "キャンセル",
  suspended: "停止中",
};

export const platformLabels: Record<string, string> = {
  instagram_feed: "Instagram Feed",
  instagram_reel: "Instagram Reel",
  instagram_story: "Instagram Story",
  tiktok: "TikTok",
  youtube_shorts: "YouTube Shorts",
  ugc_photo: "UGC写真",
  ugc_video: "UGC動画",
};
