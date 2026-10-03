# Pilot E2E Checklist

Use two separate browser profiles so Creator and Restaurant sessions do not interfere.

## A. Account setup

- [ ] /api/health returns database: ok (wrong/partial Supabase schemas must fail).
- [ ] Operator account is admin.
- [ ] Creator signs up and completes Creator onboarding.
- [ ] Creator registers Instagram metrics.
- [ ] Restaurant signs up and completes Restaurant onboarding.
- [ ] Restaurant dashboard opens without cross-account data leakage.

## B. Normal MARKET transaction

Restaurant:
- [ ] Create a campaign with cash reward.
- [ ] Food offer is separate from cash reward.
- [ ] Select visit period.
- [ ] Select weekdays.
- [ ] Generate 30-minute arrival slots.
- [ ] Publish.

Creator:
- [ ] Campaign appears in MARKET.
- [ ] Reward is visible before applying.
- [ ] Select multiple exact slots.
- [ ] Test "19:00以降ならいつでも".
- [ ] Select party size.
- [ ] Apply.
- [ ] Creator can withdraw a still-pending application and sees a clear result.

Restaurant:
- [ ] Applicant appears.
- [ ] Only overlapping/open candidate slots appear.
- [ ] Confirm one slot.
- [ ] Restaurant can one-tap reject an application without chat negotiation.
- [ ] Restaurant can close recruitment without cancelling confirmed bookings.

Both:
- [ ] Creator sees confirmed booking.
- [ ] Slot capacity decreases.
- [ ] Creator receives booking notification.

## C. Concurrency

- [ ] Create one slot with capacity 1.
- [ ] Attempt two confirmations against the same last slot.
- [ ] Exactly one succeeds.
- [ ] reserved_count never exceeds capacity.

## D. Reschedule

Creator:
- [ ] Open confirmed booking.
- [ ] Select another open time.
- [ ] Request change.

Restaurant:
- [ ] Request appears in reschedule queue.
- [ ] Approve it.
- [ ] Old slot reopens when capacity allows.
- [ ] New slot capacity decreases.
- [ ] Booking now references new slot.

Repeat once and reject:
- [ ] Original booking time remains unchanged after rejection.
- [ ] Reschedule action disappears after the original visit starts.
- [ ] Direct RPC attempt after visit start is rejected.

## E. Deliverable

Creator:
- [ ] Submit Instagram/TikTok URL.
- [ ] Application moves to submitted when all required URLs exist.

Restaurant:
- [ ] Open booking.
- [ ] Review URL.
- [ ] Reject with note once.
- [ ] Creator sees revision note/notification.
- [ ] Resubmit.
- [ ] Approve all required deliverables.
- [ ] Approved deliverable URL becomes immutable.
- [ ] Restaurant cannot reverse an approved deliverable after payout approval.

Payment:
- [ ] Payment becomes approved.
- [ ] Creator Wallet shows approved amount.
- [ ] Due date is created.

## F. Manual payout

Admin:
- [ ] Approved payment appears in payout queue.
- [ ] Mark scheduled.
- [ ] Creator receives notification.
- [ ] Make actual pilot transfer outside app.
- [ ] Mark paid.
- [ ] Creator Wallet shows paid.

## G. FLASH

Restaurant:
- [ ] Create an urgent campaign.
- [ ] Set visit time after now.
- [ ] Set application deadline before visit.
- [ ] Confirm it is separated from normal MARKET.

Creator:
- [ ] FLASH campaign is visible in FLASH.
- [ ] Open and apply using its available slot.

## H. Reminders

- [ ] Cron request without secret returns 401.
- [ ] Authorized cron succeeds.
- [ ] 24h visit reminder is created once.
- [ ] Re-running cron does not duplicate reminder.
- [ ] 24h deliverable reminder is created once.
- [ ] Expired recruitment moves to 募集終了 automatically.
- [ ] Pending applicants receive their outcome when recruitment closes.

## I. Operator Inbox Zero

- [ ] Healthy transactions do not appear as exceptions.
- [ ] Overdue deliverable appears.
- [ ] Overdue payment appears.
- [ ] No-show/dispute states appear.
- [ ] Resolved exception disappears from active queue.

## J. STUDIO (UGC and usage rights)

Restaurant:
- [ ] Create a campaign with UGC写真 and no usage rights → blocked with a clear message.
- [ ] Choose SNS/Web + ads with fee 0 → blocked.
- [ ] Publish with UGC写真 + 90日 + fee.

Creator:
- [ ] Campaign card/detail shows the usage terms before applying.
- [ ] After booking, Wallet/booking shows reward + usage fee.
- [ ] Upload 2 photos from a phone (HEIC from iPhone included).
- [ ] A PDF or an oversized file is rejected with a clear message.
- [ ] Remove one file, deliver the rest.

Restaurant:
- [ ] Files open on the booking page while reviewing.
- [ ] Approve all deliverables → license shows 90 days remaining.
- [ ] /restaurant/studio shows the files with download links.
- [ ] Creator can no longer delete approved files.
- [ ] (SQL, test project only) set `expires_at` in the past → files show 利用期限切れ and cannot be opened.

## K. SIGNAL (attribution)

- [ ] Confirmed booking shows the Creator's PR link and PR code.
- [ ] Restaurant sets reservation URL and phone on /restaurant/signal.
- [ ] Open the PR link logged out on a phone: PR disclosure, code, buttons, privacy note.
- [ ] Opening the link increases 閲覧 once per tab; Instagram link preview does not.
- [ ] Tapping 予約する / 電話 increases 予約ボタン.
- [ ] Restaurant records a reservation and a visit with spend using the spoken code ("abcd efgh" also works).
- [ ] Wrong / other restaurant's code is rejected without revealing which.
- [ ] Mistaken record can be voided and totals update.
- [ ] Cost per visit and 売上 ÷ 費用 match a manual calculation.
- [ ] Creator sees counts but not spend.

## L. PROOF (Creator performance)

Creator (グルメ日誌):
- [ ] Paste the 30-day insights (docs/CREATOR_PERFORMANCE.md) → preview shows 8投稿・約12.4万閲覧.
- [ ] A broken line shows the line number and reason; save stays disabled.
- [ ] Save, then send the insights screenshot.
- [ ] Publish the media kit and open `/k/<slug>` logged out (also the LINE/Instagram link preview).

Operator:
- [ ] Screenshot appears in Inbox → /admin/performance; approve → 運営確認済み.

Restaurant:
- [ ] Applicant card shows 30-day reach and links to the media kit.
- [ ] Direct OFFER picker lists Creators by reach; "この人に指名オファー" preselects the Creator.
- [ ] Another Creator cannot see グルメ日誌's numbers; the screenshot is never visible to Restaurants.

## M. PR desk (グルメ日誌 一律¥8,000)

- [ ] Creator sends only the insights screenshot → 読み取り待ち.
- [ ] Claude (`read-insights`) or /admin/performance registers it → 登録済み・運営確認済み, Creator notified.
- [ ] Creator turns on PR窓口 (¥8,000) → /order/<slug> shows the plan and results.
- [ ] Gmail opens with subject, body and the order link; the store appears in 送った店舗.
- [ ] Logged-out Restaurant: sign up from /order/<slug> → after email confirmation and onboarding it returns to the order page.
- [ ] Restaurant orders with 1–3 dates → campaign is ¥8,000・Reel 1本・食事1名分; Creator gets 指名PR notification.
- [ ] Turning PR窓口 off stops new orders.

## Exit criteria

Pilot is ready for external users only when:

- [ ] Typecheck passes.
- [ ] Lint passes.
- [ ] Tests pass.
- [ ] Production build passes.
- [ ] Database tests (`npm run test:db`) pass.
- [ ] One complete paid PR transaction succeeds.
- [ ] Normal transaction needs no Instagram DM.
- [ ] No cross-tenant data is visible.
- [ ] Payment wording clearly distinguishes approved vs paid.
