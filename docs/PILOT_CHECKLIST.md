# Pilot E2E Checklist

Use two separate browser profiles so Creator and Restaurant sessions do not interfere.

## A. Account setup

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

Restaurant:
- [ ] Applicant appears.
- [ ] Only overlapping/open candidate slots appear.
- [ ] Confirm one slot.

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

## I. Operator Inbox Zero

- [ ] Healthy transactions do not appear as exceptions.
- [ ] Overdue deliverable appears.
- [ ] Overdue payment appears.
- [ ] No-show/dispute states appear.
- [ ] Resolved exception disappears from active queue.

## Exit criteria

Pilot is ready for external users only when:

- [ ] Typecheck passes.
- [ ] Lint passes.
- [ ] Tests pass.
- [ ] Production build passes.
- [ ] One complete paid PR transaction succeeds.
- [ ] Normal transaction needs no Instagram DM.
- [ ] No cross-tenant data is visible.
- [ ] Payment wording clearly distinguishes approved vs paid.
