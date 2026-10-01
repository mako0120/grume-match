# PRD v1 — GOURMET DIARY PR OS

## 1. Product summary

GOURMET DIARY PR OS は、飲食店とグルメクリエイターを **有償PR案件・来店日程・納品・報酬管理**まで一気通貫でつなぐサービス。

最初のMVPでは、Instagram DMで発生している次の手作業を置き換える。

`案件確認 → 条件確認 → 日程候補を文章で送る → 店舗が返信 → 来店 → 投稿 → URL提出 → 報酬確認`

これを、

`案件を見る → 来店可能時間をタップ → 応募 → 店舗が日時をタップして採用 → 投稿URL提出 → 完了`

にする。

## 2. Primary users

### Creator
- 大阪を中心に活動するグルメクリエイター
- 初期対象はフォロワー約1,000〜30,000人
- フォロワー数だけでなく、地域性・動画品質・保存率・案件履行実績を重視する

### Restaurant
- 個店〜小規模チェーン
- 新店、空席、新メニュー、季節メニュー、認知拡大を目的にPRしたい店舗

### Operator
- 初期はグルメ日誌運営者1名
- 例外対応だけを人間が行い、通常運用は極力自動化する

## 3. Product principles

1. **現金報酬を明示**する。食事提供だけを報酬扱いしない。
2. **日時調整はチャットではなくタップ操作**を標準にする。
3. 店舗・Creator双方が条件を事前に確認できる。
4. フォロワー数だけで評価しない。
5. 運営者が1人でも回せるよう、自由入力と手作業を減らす。
6. 有償PRの標準成果物は Instagram / TikTok / YouTube Shorts / UGC とし、インセンティブ付き口コミを標準成果物にしない。

## 4. MVP scope (P0)

### Creator
- アカウント登録 / ログイン
- Creatorプロフィール
- SNSアカウント登録
- 案件一覧 / 検索 / 詳細
- 来店可能日時を複数タップして応募
- 「○時以降ならいつでも」応募
- 応募状況確認
- 採用日時確認
- 投稿URL提出
- 報酬ステータス確認

### Restaurant
- 店舗プロフィール登録
- PR案件作成
- 報酬・提供内容・募集人数・媒体・投稿期限登録
- 来店可能日時 / 時間枠登録
- 応募者一覧
- Creator選択 + 日時確定
- 投稿URL確認
- 案件完了

### Operator
- Creator / Restaurant / Campaign一覧
- 要対応項目だけを出す運営Inbox
- 投稿完了確認
- 報酬支払いステータス更新
- アカウント停止 / 案件停止

## 5. Core UX — Tap Schedule

この機能をMVPの中心UXとする。

### Restaurant setup

店舗は案件作成時に以下を設定する。

- 来店可能日
- 営業時間帯
- PR受付時間帯
- スロット間隔: 30分 / 60分
- 各スロットの受入上限
- 同伴者上限

例:

- 10/8: 17:00〜21:00
- 10/9: 17:00〜21:00
- 10/11: 18:00〜20:00
- slot interval: 30分
- capacity: 各時間1組

システムは選択可能なスロットを自動生成する。

### Creator application

Creatorは複数候補をタップできる。

- 10/8 19:00
- 10/9 19:00
- 10/11 19:00

または、

- 10/8 19:00以降
- 10/9 19:00以降

を選択できる。

「19:00以降」は曖昧テキストではなく、`flexible_after=19:00` として構造化保存する。

### Restaurant confirmation

店舗はCreatorの候補と空きスロットの共通部分だけを見る。

例:

- 10/8 19:00
- 10/8 19:30
- 10/8 20:00
- 10/9 19:00
- 10/9 19:30

店舗が1つタップすると予約日時が確定し、該当スロットの残数を減らす。

### Required behavior

- ダブルブッキング防止
- 店舗側の受入上限超過防止
- Creator自身の確定済み案件との重複警告
- Asia/Tokyo固定で開始し、将来timezone対応
- 変更申請は「利用可能な別スロットを選ぶ」方式
- 自由入力の日程交渉は例外対応のみ

## 6. Campaign fields

必須:
- restaurant_id
- title
- description
- category
- area
- cash_reward
- reward_tax_mode
- food_offer
- max_companions
- creator_slots
- platforms
- deliverables
- application_deadline
- visit_period_start / end
- post_deadline_rule
- status

任意:
- follower_min/max
- target_audience
- required_shots
- hashtags
- mention_accounts
- content_usage_rights
- notes

## 7. State machines

### Campaign
`draft → published → recruiting → filled → in_progress → completed`

例外:
`cancelled / suspended`

### Application
`applied → shortlisted → accepted | rejected | withdrawn`

accepted後:
`scheduled → visited → submitted → approved → paid`

例外:
`reschedule_requested / cancelled / dispute`

### Booking
`held → confirmed → visited`

例外:
`reschedule_requested / cancelled / no_show`

## 8. Deliverables

MVPでは以下をサポート。

- Instagram Feed
- Instagram Reel
- Instagram Story
- TikTok
- YouTube Shorts
- UGC photo
- UGC video

各deliverableは:
- required boolean
- due_at
- submitted_url
- submitted_at
- verification_status

を持つ。

## 9. Payment model

### MVP
プラットフォーム内決済は行わず、報酬金額・支払期日・支払状態を管理する。

Status:
- pending
- approved
- scheduled
- paid
- failed

### Later
Stripe Connect等を利用したマーケットプレイス決済を検討する。法務・税務・資金移動の仕様を確認した後に導入する。

## 10. Creator profile

- display_name
- bio
- base_area
- categories
- Instagram / TikTok / YouTube
- followers
- average_views
- average_saves
- local_audience_ratio
- min_reward
- travel_radius
- available_days
- content_types
- portfolio
- reliability metrics

MVPでは自己申告 + 運営確認。
API自動取得は後続フェーズ。

## 11. Restaurant dashboard

最初にグラフを並べず、以下を優先する。

- 応募者が来ている案件
- 日時確定待ち
- 来店予定
- 投稿待ち
- 完了待ち

「次に何をすればよいか」が1画面で分かること。

## 12. Operator Inbox Zero

運営画面は通常案件を隠し、「人間が対応する必要がある例外」だけを表示する。

例:
- 支払期限超過
- 24時間以上未回答
- 日程衝突
- no-show
- 投稿期限超過
- dispute
- アカウント確認

## 13. Out of scope for MVP

- 自動振込 / エスクロー
- AIによる自動採用
- Instagram/TikTok APIからの自動インサイト取得
- 予約サイトとの本番連携
- 来店コンバージョン計測
- UGC素材販売
- 広告二次利用決済
- 全国展開
- インセンティブ付きGoogle / 食べログ口コミ

## 14. Success metrics

Pilot:
- Creator 20人
- Restaurant 5店舗
- 有償案件 10件
- 応募→日時確定率 60%以上
- 日程調整DM往復 80%削減
- Creator来店履行率 95%以上
- 投稿期限遵守率 90%以上

Product:
- Time to schedule
- Applications per campaign
- Fill rate
- Creator repeat rate
- Restaurant repeat rate
- Average creator cash reward
- Operator manual touches per completed campaign

最重要KPIの1つは **Operator manual touches / completed campaign**。
個人運営できるかを定量化する。

## 15. Security / privacy

- RBAC: creator / restaurant / admin
- 店舗は応募していないCreatorの個人連絡先を閲覧できない
- Creatorも店舗担当者の私用連絡先を閲覧しない
- 個人情報は必要最小限
- 全ての重要ステータス変更は監査ログを保持
- Admin操作は監査対象
- ファイルアップロードはMIME/size制限
- 秘密情報をクライアントへ埋め込まない

## 16. Launch approach

### Pilot
大阪限定。
グルメ日誌自身をCreator #1として利用。

1. Creator 20名を手動招待
2. 店舗5店を手動オンボーディング
3. 10案件を実運用
4. DMで発生した例外を記録
5. 20〜50案件後に自動決済・AI機能の優先順位を再評価

## 17. Definition of MVP done

以下のシナリオがスマホで完結する。

1. 店舗が有償案件を公開
2. Creatorが案件を発見
3. Creatorが来店希望時間を3候補タップ
4. 店舗が1候補をタップして採用
5. 双方に確定日時が表示
6. Creatorが来店
7. Creatorが投稿URLを提出
8. 店舗/運営が確認
9. 支払い済みに更新
10. 案件がcompletedになる

このフローで通常ケースにDM・メールを必要としないこと。
