# グルメ日誌 自動受付 V1 — 安全な導入手順

**現在の状態**：GitHub PR #23 内に実装。2026-10-22時点で「自動取込のコード作成・CI確認」は完了していますが、Netlify/Google側の認証と起動設定は未完了。**まだ自動連携は動いていません**。

## 構成

| システム | 何をする | 更新頻度 |
| --- | --- | --- |
| Netlify Forms | 公開フォームの受付・正式な原本 | 申込み時 |
| Web管理画面 `/diary/ops` | 管理者認証後に新規フォームを読み取る | 画面を開いている間、60秒ごと |
| Google Sheets `07_自動受付` | 新規受付をIDで重複排除して追記 | Apps Script設定後、約5分ごと |
| `01_案件ボード` | 成約・来店・請求・入金の運用ステータス | 今は手入力（双方向同期は未実装） |

**注意：** Google SheetsとWebの「編集済みステータス・入金額」はまだ自動的には同期しません。Web画面で編集した状態は再ログイン/再読込で失われるため、CSV保存が必要です。運用の正本はGoogle Sheetsの案件ボードに置いてください。

## A. スプレッドシートを専用Gmailに複製

現在の共有ボード（原本）は大学Googleアカウントが所有者、グルメ日誌専用Gmailは編集者です。大学アカウントの卒業後の無効化に備え、実在のお客様のデータを入力する前に次の操作を実施してください。

1. グルメ日誌専用のGmailに切り替える。
2. 共有された「グルメ日誌｜PR案件管理ボード」を開き、**ファイル → コピーを作成** で専用Gmail所有のGoogleドライブに複製する。
3. 新しいファイルが一般公開されていないことを確認する。
4. コピー後のURLのスプレッドシートID（`/d/<ここ>/edit`）を控える。
5. 旧版はテスト用バックアップとして扱い、顧客情報を複数ファイルに広げない。

## B. 自動受付（約5分おき）の有効化

1. Netlifyユーザー設定でAPI用Personal Access Tokenを発行する。**フォーム読取に不要な権限が絞れるとは限らないため、管理者本人だけが保持すること**。トークンをチャット・GitHub・シートのセルに入力しない。
2. NetlifyプロジェクトのGeneral settingsから**Site ID/API ID**を控える。
3. 専用Gmail所有のコピーした管理表で **拡張機能 → Apps Script** を開く。
4. GitHubの `scripts/diary-netlify-sheets-sync.gs` のコードをApps Scriptのエディタにコピーして保存。
5. Apps Script **プロジェクトの設定 → スクリプト プロパティ** に次の3件を追加する。値はWebに公開しない：
    - `NETLIFY_API_TOKEN` : Netlifyの発行済みトークン
    - `NETLIFY_SITE_ID` : NetlifyのSite API ID
    - `SPREADSHEET_ID` : 専用Gmail所有のGoogle SheetのID
6. Apps Scriptで関数 `setupDiaryAutoSync` を一度実行し、Googleのアクセス許可を確認する。すぐに1回同期し、以降5分ごとの時間主導トリガーを1個作成する。
7. コピーした管理表の `07_自動受付` と `00_ホーム` を確認。Netlify側の検証済み受付が1件だけ追加されるか、同じ申込みが二重に入らないかをテストする。個人情報はテスト用アドレスで検証する。
8. Apps Script「実行数」でエラーが発生していないことを確認する。停止する場合は `stopDiaryAutoSync` を実行。同期済みデータは維持される。

**制限**：最初の同期で最大2,000件まで確認。上限超過はデータを部分追記せずエラー。悪意のある先頭式文字は文字列として処理。ネットワーク障害時にも既存行を消去しない。操作中の誤削除や自動的な成約・課金は行わない。

## C. Webダッシュボードの自動更新（60秒）

1. Netlifyプロジェクトの **Identity** を有効化し、Registrationを**Invite only**に設定。グルメ日誌専用Gmailだけを招待する。Identity利用者に`admin`ロールを割り当てる。
2. Netlifyの環境変数を設定する。これらの値を公開JavaScriptや`NEXT_PUBLIC_`に入れないこと。
   - `DIARY_OPS_AUTO_SYNC_ENABLED=true`（Productionだけ）
   - `DIARY_OPS_OWNER_EMAIL`＝専用Gmailアドレス
   - `DIARY_NETLIFY_SITE_ID`＝Site API ID
   - `DIARY_NETLIFY_API_TOKEN`＝APIトークン（Secret、Functionsスコープ）
3. **権限・認証テストが完了するまでは本番ブランチへPRをマージしないこと。** Netlify productionは公開ブランチ `feat/gurume-diary-direct-pr`。
4. 本番の `/diary/ops` から「自動同期ログイン」に専用GmailのNetlify Identity認証情報を入力。自動更新中は60秒間隔で取込。画面を閉じている間もNetlify Formsへの原本受付は続く。
5. 403/401・フォーム未検出・接続失敗は警告を表示する。エラーを空の正常データとして扱わない。

現バージョンは**受付データの読み取り**だけ自動化。進捗更新のサーバー永続化とWeb/Sheets間の双方向同期は次のフェーズ。現時点では成約/入金の操作は、日常運用をしている原本管理表に集約する。

## 最低限の安全確認

- Netlify管理画面、Googleアカウントの多要素認証（パスキー推奨）を有効化。
- Google Sheets共有設定は**制限付き**。大学アカウントから離した専用Gmail所有のコピーを使用。
- Web側のプライベートAPIが未認証で401、別ユーザーで403、トークン欠落時503になることを確認。
- Netlify個人アクセストークンは漏洩リスクが高い。GitHubにプッシュ・画面共有・メール送信しない。漏洩時はNetlifyで直ちに失効。
- 連携エラーを受け取る仕組みは運用側の追加課題。NetlifyフォームのGmail通知を引き続き運用する。

## 参考
- https://docs.netlify.com/manage/forms/submissions/
- https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/
- https://docs.netlify.com/manage/security/secure-access-to-sites/identity/overview/
- https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app
- https://developers.google.com/apps-script/guides/v8-runtime

---

## D. オプション：案件ボード自動登録（V2・初期OFF）

実装ファイルは `scripts/diary-netlify-sheets-sync.gs`、テストは
`tests/diary-ops-board-reconcile.test.mjs` です。

専用Gmail所有のコピーにあるApps Scriptを最新コードに更新した**後**、
Script Propertiesに `DIARY_BOARD_AUTOCREATE_ENABLED=true` をオーナーが設定すると、
次回の約5分同期から `07_自動受付` に加えて `01_案件ボード` にも新規IDを登録します。
初期値はOFFです。列見出し `C5:店舗・企業`、`D5:進捗ステータス`、
`U5:Netlify受付ID` が一致しなければ処理は停止します。

- 受付ID（A/U列）で重複を拒否。すでに受付済みだが案件ボードに未登録のIDも次回再照合。
- 手入力済みの行を検出してスキップ。既存のステータスや売上額は上書きしません。
- 新規行のL列の未収額計算式を保持。新規登録は「未対応」に限定し、成約・入金を自動判定しません。
- 一度でも成功した時点で `DIARY_LAST_BOARD_COUNT`、`DIARY_LAST_SUCCESS` を Script Properties に記録。
- 失敗した場合はApps Script実行履歴で確認。外部への専用の同期失敗通知は**未実装**。

**重要：** 対象の大学所有の元シートではなく、専用Gmail所有のコピーに適用してください。
オーナーによるコード配置とトリガー設定の承認前には同期は動きません。

## E. オプション：Web→Sheetsへの進捗保存（V2・初期OFF）

Netlify Formsが**申込受付の原本**、専用Gmail所有の
`01_案件ボード` が**進捗・金額・来店・投稿・入金の唯一の運用正本**です。
Webは独立したDBを作りません。

関連ファイル：

- `netlify/functions/diary-ops-state.mjs` : Netlify Identity本人認証、管理ロール、保存要求の検証、署名通信
- `scripts/diary-ops-state-webapp.gs` : Google Sheetsの読取・進捗保存、排他ロック、HMAC照合、再送防止、リビジョン検査
- `app/diary/ops/components/diary-ops-console.tsx` : 60秒読取、画面での手動保存と競合警告

### オーナーが承認後に実行する設定

1. 専用GmailのコピーのApps Scriptに、元の同期コードと `diary-ops-state-webapp.gs` の**両方**を配置。
2. Script Properties に `DIARY_SHEETS_HMAC_SECRET` を設定（長さ32文字以上の強いランダム値）。
   秘密値をChatGPT・GitHub・Sheetセル・ブラウザJavaScriptへ貼らない。
3. `setupDiaryOpsAuditSheet` を手動で一度実行し、
   非公開の `08_変更履歴` シートを作成。共有設定は「制限付き」を維持。
4. コード監査・権限テスト後、Apps ScriptをWebアプリとしてデプロイ。
   **「自分として実行」かつ「全員」**の公開入口になるため、URLは秘密でなくとも
   HMAC秘密値の保護が必須。使用するGoogleアカウント・権限範囲を確認してから承認する。
5. NetlifyのFunctions専用秘密環境変数に
   `DIARY_SHEETS_HMAC_SECRET` と `DIARY_SHEETS_WEBAPP_URL` を設定。
   SecretはApps Scriptの値と一致させる。
6. その他の本人認証設定と動作確認がすべて終了してから、Netlify環境で
   `DIARY_OPS_STATE_ENABLED=true` とする（それまではOFF）。
   `DIARY_OPS_AUTO_SYNC_ENABLED=true` および `DIARY_OPS_OWNER_EMAIL` も必要。
7. 正規の管理者だけで疎通確認。未認証401・他ユーザー403・未設定503、
   古いバージョン409、無効な入力400、保存後のSheetsリロード反映を確認。
   Google Sheetを手編集した直後のWeb保存は競合として拒否すること。

保存は明示的な「Google Sheetsに保存」操作のみ。
Stripe請求、入金確認の自動実行、自動成約は含みません。
クライアントにはAPIトークン・HMAC秘密値を返しません。

### ロールバックと残余リスク

- 即時停止：`DIARY_OPS_STATE_ENABLED=false`、
  `DIARY_BOARD_AUTOCREATE_ENABLED=false`。
  Netlify側設定変更や本番デプロイは事前のオーナー承認が必要。
- Apps Scriptの公開Webアプリは署名により保護されますが、
  認証付きGoogle API直接接続と比べて公開攻撃面が増えます。
  コード実装だけをもって商用利用可能とは判定しません。
- Sheetsは完全なトランザクションDBではありません。
  更新した行と監査行の書込みの間で失敗した場合は、
  Webで保存完了と判定せず、手動で変更履歴と対象行を確認してください。
- Script Propertiesの秘密値はオーナーが保管し、
  漏洩時には両サービスで交換してWebアプリのアクセスを遮断してください。
- Netlify Identityのパスワード認証では独自MFAの強制をまだ検証できていません。
  Googleログインなどの認証移行と管理者のMFA必須化を別途安全性評価します。

## 公式仕様（2026-10-22確認）

- Netlify Identityはcredit-basedプランで招待制とFunction認証に対応。
  新規実装の推奨ライブラリは `@netlify/identity`（既存のログイン方式は移行検討中）。
  https://docs.netlify.com/manage/security/secure-access-to-sites/identity/overview/
- Google Apps Scriptは `doPost(e)` のWebアプリを所有者権限で実行可能。
  https://developers.google.com/apps-script/guides/web
- 無料GmailのApps Script UrlFetch上限は現在20,000回/日、トリガー合計90分/日。
  5分ごとなら約288回/日で、受付1ページの場合はNetlify API約576回/日。
  https://developers.google.com/apps-script/guides/services/quotas
- Netlifyの従量クレジットはFunction computeとリクエスト量が課金対象。
  https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/
