export const paymentStatusLabels: Record<string, string> = {
  pending: "確認待ち",
  approved: "支払承認済み",
  on_hold: "運営確認中",
  scheduled: "振込予定",
  paid: "支払済み",
  failed: "要確認",
  cancelled: "キャンセル",
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
  visit_confirmed: "来店確認",
  booking_cancelled: "キャンセル",
  booking_no_show: "来店状況",
  booking_dispute_opened: "運営確認",
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
  participant_verified: "利用確認",
  participant_suspended: "利用状態",
  account_suspended: "アカウント",
  account_closure_dismissed: "アカウント",
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

export const bookingStatusLabels: Record<string, string> = {
  held: "仮確定",
  confirmed: "来店予定",
  visited: "来店済み",
  reschedule_requested: "日時変更中",
  cancelled: "キャンセル",
  no_show: "来店なし",
};
