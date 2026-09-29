# Architecture v1

## Recommended stack

### Web
- Next.js + TypeScript
- App Router
- Responsive mobile-first UI

### Backend / data
- PostgreSQL
- Supabaseを第一候補として Auth / Postgres / Storage をまとめる
- Domain logicはNext.jsのRoute Handler / Server Actionsに閉じ込めすぎず、service層として分離する

### Later
- Stripe Connect: 分配決済
- Queue/worker: 通知、期限チェック、分析
- Object storage: UGC素材
- AI worker: brief生成、候補推薦、投稿チェック

## Logical modules

```
apps/web
  app/
    (creator)/
    (restaurant)/
    (admin)/
    api/
  components/
  features/
    auth/
    campaigns/
    applications/
    scheduling/
    bookings/
    deliverables/
    payments/
    notifications/
  lib/
  server/
    services/
    repositories/
    policies/
    validators/

packages/
  domain/
  ui/
  config/

supabase/
  migrations/
  seed.sql

docs/
```

モノレポ化は、実際に共有packageが必要になるまでは過剰にしない。
MVPでは単一Next.js appでも良いが、feature境界は維持する。

## Domain boundaries

### Campaign
店舗が公開する募集条件。
日程確定前。

### Application
Creatorの応募意思 + 候補日時。

### Booking
店舗が採用し、日時が1つに確定した状態。

### Deliverable
来店後の納品義務。

### Payment
Creatorに対する現金報酬の支払管理。

これらを1テーブルにまとめない。

## Scheduling consistency

最重要な整合性領域。

Booking確定処理は必ずサーバー側transactionで行う。

Pseudo flow:

```
BEGIN
slot = SELECT ... FOR UPDATE
assert slot.reserved_count < slot.capacity
assert creator has no conflicting confirmed booking
INSERT booking
UPDATE slot SET reserved_count = reserved_count + 1
UPDATE application SET status = 'scheduled'
COMMIT
```

失敗時は409 conflictを返し、UIに「この枠は直前に埋まりました」を表示する。

## Authorization

### Creator
- 公開中Campaign閲覧
- 自分のApplication/Booking/Deliverableのみ編集
- Restaurant内部情報閲覧不可

### Restaurant
- 自店舗Campaignのみ作成・編集
- 自店舗Campaignへの応募者のみ閲覧
- 他店舗データ閲覧不可

### Admin
- moderationと運用に必要な範囲

すべてRLSまたはサーバー側policyで二重防御する。

## Notifications

MVP:
- in-app notification
- email

Trigger:
- application received
- application accepted/rejected
- booking confirmed
- booking reschedule requested
- 24h before visit
- deliverable due soon
- deliverable overdue
- deliverable approved
- payment status changed

## Observability

初期から最低限:
- request error logging
- domain event logging
- booking conflict count
- notification failure
- admin manual touch event

「一人運営できるか」を測るため、adminによる手動操作回数をイベント化する。

## Failure modes

- 同時予約 → row lock + capacity check
- 店舗が募集停止 → 新規応募不可、既存bookingは保持
- Creator退会 → 未完了bookingがあれば即時削除不可
- 投稿期限超過 → 自動リマインド + Admin Inbox
- 支払い遅延 → Admin Inbox
- 店舗/Creator無断キャンセル → reliability metricへ反映
- 外部SNS障害 → URL提出を保持し再検証可能にする

## Deployment stages

### Local/Pilot
- Vercel
- Supabase
- manual payments

### Growth
- background worker
- object storage/CDN
- Stripe Connect
- monitoring/alerting
- analytics warehouse only if needed

## Security checklist

- secrets only server-side
- Zod等で全入力validate
- CSRF/XSS/URL validation
- upload size/MIME restriction
- rate limit for auth/application
- audit logs for admin and payment state
- no sensitive data in logs
- account deletion/retention policyを実装前に文書化
