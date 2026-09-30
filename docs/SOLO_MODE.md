# SOLO Mode

GOURMET DIARY PR OS は、**1人でPR来店するCreator** と **1人で運営するOperator** の両方を標準ケースとして扱う。

## 1. Creatorの1人来店

基本ルール:
- party_size の最小値は1
- Creator画面は1名を初期選択する
- 同伴者は任意
- 店舗が同伴者を許可していても、Creatorは1人で応募できる
- max_companions=0 の案件は1名限定
- max_companions=1 の案件は1〜2名
- max_companions=2 の案件は1〜3名

案件カードには:
- 1名限定
- 1名からOK

を表示して、応募前に判断できるようにする。

## 2. Restaurantの案件作成

店舗は「同伴者がいる前提」で案件を作らない。

標準:
- 食事提供: 1名分
- 来店人数: 1名から
- 必要な場合のみ同伴者上限を増やす

これにより、急募・FLASHでも1人Creatorが参加しやすくなる。

## 3. Solo Operator

初期運営者が1名でも回せることを前提にする。

人間が毎回処理しないもの:
- 応募受付
- 日程候補保存
- Booking確定
- 通知
- 来店前リマインド
- 投稿期限リマインド
- Wallet状態更新

人間が見るもの:
- 支払対応
- dispute
- no-show
- 投稿期限超過
- 例外的な日程変更

重要KPI:
`operator_manual_touches / completed_campaign`

案件数が増えても、運営者のDM作業が同じ比率で増えないことを目標にする。


## 4. 1人を指名する Direct OFFER

公開募集をせず、店舗がCreatorを1人だけ選んで有償依頼できる。

Flow:

```
Restaurant
→ Creatorを1人選択
→ 現金報酬・提供内容・来店候補を送る
→ Creatorの「指名オファー」にだけ表示
→ Creatorが来店日時を選択
→ 既存Tap Schedule / Bookingへ接続
```

Direct OFFERは公開MARKETには表示しない。
対象Creator以外はcampaign IDを知っていても応募できないようDB側で制御する。

また、公開中のPR案件・FLASH・Direct OFFERはいずれも現金報酬0円では公開できない。
