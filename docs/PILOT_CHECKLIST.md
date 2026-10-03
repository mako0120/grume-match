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
- [ ] Open the PR link logged out on a phone: PR disclosure, code, map / post links, privacy note (no reservation buttons).
- [ ] Opening the link increases 閲覧 once per tab; Instagram link preview does not.
- [ ] Restaurant records a visit with party size and spend using the spoken code ("abcd efgh" also works).
- [ ] Wrong / other restaurant's code is rejected without revealing which.
- [ ] Mistaken record can be voided and totals update.
- [ ] Cost per visit, 閲覧→来店 and 売上 ÷ 費用 match a manual calculation.
- [ ] Creator sees counts but not spend.

## L. PROOF (Creator performance)

Creator (グルメ日誌):
- [ ] Send only the insights screenshot → 読み取り待ち.

Operator / Claude:
- [ ] Screenshot appears in Inbox; Claude (`read-insights`) or /admin/performance registers 8投稿・約12.4万閲覧 → 運営確認済み, Creator notified.

Restaurant:
- [ ] Applicant card shows 30-day reach and links to the media kit.
- [ ] Direct OFFER picker lists Creators by reach; "この人に指名オファー" preselects the Creator.
- [ ] Another Creator cannot see グルメ日誌's numbers; the screenshot is never visible to Restaurants.

## M. Matching

- [ ] Publish a campaign → message says how many matching Creators were notified; they see 「招待あり」 first.
- [ ] Applicants are ordered best fit first, with reasons and cautions.
- [ ] おすすめCreator lists non-applicants (new Creators in the area included); 招待する notifies them once.
- [ ] A Creator whose minimum reward is above the campaign reward is never recommended or auto-invited.
- [ ] Direct OFFER picker lists Creators by fit to the restaurant's area.

## N. After the PR (reviews and post reports)

- [ ] Before the post is approved there is no review form.
- [ ] After approval both sides see 相互評価. The first reviewer sees 「…の評価を待っています」, not the other side's stars.
- [ ] After both review, both reviews are shown; neither can be edited.
- [ ] Creator campaign cards show 「Creator評価 ★x.x（n件）」 for that Restaurant.
- [ ] Creator sends one insights screenshot of the PR post from the booking page → 「スクショを受け取りました」.
- [ ] `npm run post-reports -- list` downloads it; `submit … --yes` registers it; reach > views is refused.
- [ ] Restaurant booking page shows 投稿レポート（運営確認済み） with 1,000閲覧あたり; /restaurant/signal totals include it.
- [ ] Both sides get a notification. The Restaurant can never open the screenshot.
- [ ] `npm run ops` lists every queue; a ★2 review appears under reviews-low and in /admin until `followed-up`.

## O. Platform fee

- [ ] Campaign / OFFER / FLASH forms show the fee rule and examples under the reward.
- [ ] Before any PR completes, the booking page shows 手数料 ¥0 「最初に完了したPRは手数料無料」.
- [ ] The first completed PR is recorded as 無料; the second as 請求予定 ¥2,000 (reward ¥8,000).
- [ ] /restaurant/billing groups fees by month; /restaurant/signal PR費用 includes the fee.
- [ ] `npm run ops -- fees` lists them; `fee-status invoiced` then `paid` updates the Restaurant's page.
- [ ] The Creator's payment amount never changes.
- [ ] A meal-only invitation (現金報酬 0円) can be published; cards show 「食事招待」; Creators with a minimum reward are not invited.
- [ ] Completing a meal-only PR settles the ¥0 payment without a 「¥0 の報酬」 notification and records a ¥2,000 fee.

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
