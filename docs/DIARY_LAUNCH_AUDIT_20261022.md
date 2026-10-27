# グルメ日誌｜公開可否・客観監査（2026-10-22）

## 判定

- **Instagram PRの紹介・無料相談：条件付きで限定受付可。**
  ネイティブNetlify Formsの受付と通知は過去にテスト済み（最新デプロイでは再確認未実施）。
  管理者による手動受付・返信ができる範囲に限定する。契約・料金・納品物の合意は人間確認。
- **Web案件管理の本番永続化：No-Go（初期OFFを維持）。**
  Netlify Identityのadmin招待/失効/MFA確認、Google Apps Script秘密値・署名・復元の
  実環境試験が未完了。CIの模擬E2Eは十分条件ではない。
- **Creator/RestaurantマッチングSaaS一般公開：No-Go。**
  `docs/COMMERCIAL_LAUNCH.md` のDB・マイグレーション・実有償取引、
  マルチテナント分離、運営者/税務/決済・Stripe Connect・復旧のゲートが未完了。
  既存公開サイトのNetlify PR受付とSupabaseマーケットプレイスを同一視しない。

## 確認できた証拠

- GitHub本番ブランチ `feat/gurume-diary-direct-pr` は
  `84ba7dd` 時点でGitHub Actions #643成功（lint、test、audit、build）。
- リポジトリはPUBLIC。すべての秘密値・顧客情報は公開コードに追加しない。
- Google Drive既存の管理表は大学Googleアカウント所有で、編集者と合わせ2アカウントのみ。
  原本とは別の非共有バックアップを作成済み。監査タブ `08_変更履歴` 追加済み。
- Netlify Deploy PreviewとCIの成功は確認。公開URLのブラウザ到達性、
  受付/返信・Web認証/Apps Script接続・実決済はこの監査で保証できない。
- ステルスマーケティングを受けない受注方針とプライバシー説明を掲載。
  実際の投稿で明瞭なPR表示、許諾を運用確認する必要あり。

## 高優先度の改善（今回のPR）

1. 料金の矛盾: 公開トップ/サーバーのフォロワー別料金と申込みフォームの固定8,000/15,000円表示を統一。
2. 決済の誤認: Stripeが有効でない限り、Stripe請求書の発行を確約しない。
3. インサイト数値: 一次証拠を確認するまで `DIARY_METRICS_VERIFIED=true` を設定せず、未確認の指標表示を公開しない。
4. `DIARY_SITE_MODE` を本番ビルド時に固定し、Netlify上の法定表示が別サービスに切り替わるリスクを抑える。
5. `npm run check:diary-launch` で本番環境設定を検査。実運用と法務の承認は**常に別の人間ゲート**とする。

## 一般公開前の必須アクション

### PR紹介・相談窓口の公開

- Netlifyの有効な本番デプロイURLとPC/スマホの操作（フォーム送信→原本→Gmail通知）を再確認。
- `NEXT_PUBLIC_OPERATOR_NAME`、`NEXT_PUBLIC_SUPPORT_EMAIL` を実際の運営者情報で設定。
  氏名・所在地・電話/表示方法・契約前案内・税務は役務内容と適用法令に応じて確認する。
  個人住所等をGitHubへ直接コミットしない。
- `DIARY_VERIFIED_FOLLOWERS`, `DIARY_FOLLOWERS_VERIFIED_AT` を実測値で更新。
  インサイト数値を使用する場合は一次証拠確認後に `DIARY_METRICS_VERIFIED=true`。
- 契約に入る前に価格・請求書形式・税込表示・キャンセル・素材二次利用・
  PR表記・支払手段を確認し、双方の同意を保管。
- 保管する受付情報、Google Workspaceアカウントの権限・退学/卒業後の継続性、
  個人情報の保管期間と削除手順を確認。

### 案件管理の自動化

- Netlify Identityが招待制であること、管理者メールの一致、adminロール、
  無認証401/別ユーザー403/期限切れの実環境動作をテスト。
- Apps Scriptで Netlify Forms取得と `07_自動受付` をテスト申込みで検証。
  保存APIはHMAC漏洩・再送・競合・中途失敗（監査BEGINのみ）の復旧を演習。
- 本番フラグは認証・復旧が完了するまでOFF。公衆向けの管理ログや顧客データは出さない。

### マッチングSaaS

- 専用データベースと環境設定、マイグレーション、RLSの実機検証、別人格アカウントでの否認テスト、
  有償パイロット1件の完結、入金・返金・支払整合、運営者/会計/法令をすべて満たしてから公開。

## 一次資料

- 消費者庁 ステルスマーケティングQ&A:
  https://www.caa.go.jp/policies/policy/representation/fair_labeling/faq/stealth_marketing
- 特定商取引法ガイド（通信販売広告）:
  https://www.no-trouble.caa.go.jp/what/mailorder/advertising.htmljp
- 個人情報保護委員会 通則編:
  https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/

## V2.5 — 全件性と数式保護の修正（PR #26追加分）
- Netlify FormsとGoogle Sheetsで受付IDを**双方向照合**。片方に残るレコード、重複、500件表示上限の一部取得は「売上0円」「全件一致」と扱わず、運用の保存・金額集計を停止する。
- 同期APIに失敗したら接続状態を失効させ、過去の計算値を最新と表示しない。
- 案件ボードの自動登録を事前検証し、テンプレート行の数式を破壊しない。A/U列の別行重複と数式衝突を検出した場合は原本未変更のまま停止。
- 既存Google Sheets、Identity、Apps Scriptトリガー・秘密設定は今回も変更していない。
