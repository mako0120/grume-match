# グルメ日誌 自動受付 V1 — 安全な導入手順

**現在の状態**：GitHub PR #23 内に実装。2026-10-22時点で「自動取込のコード作成・CI確認」は完了していますが、Netlify/Google側の認証と起動設定は未完了。**まだ自動連携は動いていません**。

## 構成

| システム | 何をする | 更新頻度 |
| --- | --- | --- |
| Netlify Forms | 公開フォームの受付・正式な原本 | 申込み時 |
| Web管理画面 `/diary/ops` | 管理者認証後に新規フォームを読み取る | 画面を開いている間、60秒ごと |
| Google Sheets `07_自動受付` | 新規受付をIDで重複排除して追記 | Apps Script設定後、約5分ごと |
| `01_案件ボード` | 成約・来店・請求・入金の運用正本 | 現在手入力（Webからの明示保存は初期OFF） |

**注意：** Web→Sheetsへの進捗保存機能は開発ブランチに実装済みですが、初期OFFです。本番有効化の前はWeb編集結果が再読込で失われる可能性があるため、既存Google Sheetsを運用の正本とし、バックアップCSVを利用してください。

## A. 既存のGoogle Drive・管理表を継続利用（2026-10-22 オーナー決定）

**接続済みの大学Googleアカウント、既存の「グルメ日誌｜PR案件管理ボード」をそのまま使用します。**
専用GmailへのGoogle Drive接続切替、スプレッドシートの複製・移動・所有者変更・共有権限変更は行いません。
Netlify Identityの管理者メールアドレスとGoogle Sheetsの所有者は**別の設定**であり、一致させる必要はありません。

導入前の確認事項（この章は確認手順であり、自動で設定を変更しません）：

1. 既存の管理表に `07_自動受付`、`01_案件ボード` など必要なシートと見出しがあることを確認。
2. 共有リンクが一般公開されていないか、大学アカウントに誰がアクセスできるかをGoogle Drive上で確認する。必要以上の編集権限がある場合は**オーナーに相談**し、無断で変更しない。
3. 既存表のスプレッドシートID（URL内 `/d/<ここ>/edit`）をScript Properties `SPREADSHEET_ID` に使用する。IDは公開のコードに固定しない。
4. Apps Scriptは、既存表にアクセスできる現在のGoogleアカウントで実行する。Google Workspaceの管理者が外部Webアプリ/外部APIアクセスを制限している場合は、制限を回避せず、保存機能をOFFのままにする。
5. 大学アカウントの卒業・資格変更・管理者ポリシー変更でアクセスを失う可能性がある。運用開始前に、組織ルールに沿った**安全なエクスポートと復元手順**をテストデータで用意する。バックアップに実顧客情報を無断複製しない。

**原本の既存セルは変更しません。** Apps Scriptのトリガー開始、公開Webアプリ設置、既存表への自動追記は、権限・復旧確認後の別途承認事項です。

## B. 自動受付（約5分おき）の有効化

1. Netlifyユーザー設定でAPI用Personal Access Tokenを発行する。**フォーム読取に不要な権限が絞れるとは限らないため、管理者本人だけが保持すること**。トークンをチャット・GitHub・シートのセルに入力しない。
2. NetlifyプロジェクトのGeneral settingsから**Site ID/API ID**を控える。
3. 既存の「グルメ日誌｜PR案件管理ボード」で **拡張機能 → Apps Script** を開く。
4. GitHubの `scripts/diary-netlify-sheets-sync.gs` のコードをApps Scriptのエディタにコピーして保存。
5. Apps Script **プロジェクトの設定 → スクリプト プロパティ** に次の3件を追加する。値はWebに公開しない：
    - `NETLIFY_API_TOKEN` : Netlifyの発行済みトークン
    - `NETLIFY_SITE_ID` : NetlifyのSite API ID
    - `SPREADSHEET_ID` : 現在使用中の既存Google SheetのID
6. Apps Scriptで関数 `setupDiaryAutoSync` を一度実行し、Googleのアクセス許可を確認する。すぐに1回同期し、以降5分ごとの時間主導トリガーを1個作成する。
7. 既存の管理表の `07_自動受付` と `00_ホーム` を確認。Netlify側の検証済み受付が1件だけ追加されるか、同じ申込みが二重に入らないかをテストする。個人情報はテスト用アドレスで検証する。
8. Apps Script「実行数」でエラーが発生していないことを確認する。停止する場合は `stopDiaryAutoSync` を実行。同期済みデータは維持される。

**制限**：最初の同期で最大2,000件まで確認。上限超過はデータを部分追記せずエラー。悪意のある先頭式文字は文字列として処理。ネットワーク障害時にも既存行を消去しない。操作中の誤削除や自動的な成約・課金は行わない。

## C. Webダッシュボードの自動更新（60秒）

1. Netlifyプロジェクトの **Identity** を有効化し、Registrationを**Invite only**に設定。運用に使う管理者メールアドレス（既存のグルメ日誌専用Gmailでも可）を招待し、必要な管理者だけに`admin`ロールを割り当てる。Google Driveの所有者変更は不要。
2. Netlifyの環境変数を設定する。これらの値を公開JavaScriptや`NEXT_PUBLIC_`に入れないこと。
   - `DIARY_OPS_AUTO_SYNC_ENABLED=true`（Productionだけ）
   - `DIARY_OPS_OWNER_EMAIL`＝招待・認証するNetlify Identity管理者のメールアドレス（Sheets所有者と一致不要）
   - `DIARY_NETLIFY_SITE_ID`＝Site API ID
   - `DIARY_NETLIFY_API_TOKEN`＝APIトークン（Secret、Functionsスコープ）
3. **権限・認証テストが完了するまでは本番ブランチへPRをマージしないこと。** Netlify productionは公開ブランチ `feat/gurume-diary-direct-pr`。
4. 本番の `/diary/ops` から「自動同期ログイン」に設定済みNetlify Identity管理者の認証情報を入力。自動更新中は60秒間隔で取込。画面を閉じている間もNetlify Formsへの原本受付は続く。
5. 403/401・フォーム未検出・接続失敗は警告を表示する。エラーを空の正常データとして扱わない。

進捗更新のサーバー永続化はV2オプションとして開発済み（初期OFF）。本番接続試験と承認が終わるまでは成約/入金操作は既存管理表へ集約する。

## 最低限の安全確認

- Netlify管理画面、Googleアカウントの多要素認証（パスキー推奨）を有効化。
- 既存Google Sheetsのアクセス範囲を確認し、一般公開や不要な共有を避ける。所有者・共有権限はこの開発作業では変更しない。大学アカウントの有効期限と管理者ポリシーも事前に確認する。
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

既存の案件管理ボードに紐付いたApps Scriptへ最新コードを反映し、構成・権限を検証した**後**、
Script Propertiesに `DIARY_BOARD_AUTOCREATE_ENABLED=true` をオーナーが設定すると、
次回の約5分同期から `07_自動受付` に加えて `01_案件ボード` にも新規IDを登録します。
初期値はOFFです。列見出し `C5:店舗・企業`、`D5:進捗ステータス`、
`U5:Netlify受付ID` が一致しなければ処理は停止します。

- 受付ID（A/U列）で重複を拒否。すでに受付済みだが案件ボードに未登録のIDも次回再照合。
- 手入力済みの行を検出してスキップ。既存のステータスや売上額は上書きしません。
- 新規行のL列の未収額計算式を保持。新規登録は「未対応」に限定し、成約・入金を自動判定しません。
- 一度でも成功した時点で `DIARY_LAST_BOARD_COUNT`、`DIARY_LAST_SUCCESS` を Script Properties に記録。
- 失敗した場合はApps Script実行履歴で確認。外部への専用の同期失敗通知は**未実装**。

**重要：** オーナーの決定により、大学アカウントの既存シートが同期先です。
手入力データを含むため、実運用の前に複製の代わりとなる復元試験・重複/上書き試験を実施してください。
コード配置とトリガー設定の承認前には同期は動きません。

## E. オプション：Web→Sheetsへの進捗保存（V2・初期OFF）

Netlify Formsが**申込受付の原本**、既存の大学アカウント管理表
`01_案件ボード` が**進捗・金額・来店・投稿・入金の運用正本**です。
Webは独立したDBを作りません。

関連ファイル：

- `netlify/functions/diary-ops-state.mjs` : Netlify Identity本人認証、管理ロール、保存要求の検証、署名通信
- `scripts/diary-ops-state-webapp.gs` : Google Sheetsの読取・進捗保存、排他ロック、HMAC照合、再送防止、リビジョン検査
- `app/diary/ops/components/diary-ops-console.tsx` : 60秒読取、画面での手動保存と競合警告

### オーナーが承認後に実行する設定

1. 既存の管理表に紐付いたApps Scriptに、元の同期コードと `diary-ops-state-webapp.gs` の**両方**を配置。
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

---

## F. V2.1 堅牢化（開発ブランチ / 未有効化）

次の問題を修正し、ユニットテストを追加しました。

- **手入力保護**: 案件ボードの全26列を調べ、日付・金額・メモなど一項目でも手入力された行を上書きしない。計算式だけ入ったテンプレート行は使用可能。
- **重複・超過**: 同一Netlify受付IDが運用台帳で重複している場合、同期を拒否する。運用台帳が1000行を超えた場合は表示を途中で切り捨てず、エラーとして停止する。
- **フィールド単位保存**: 進捗変更時に26列の行全体を再書込みしない。変更された許可列に限って更新し、既存の数式・担当者情報・リッチテキストなど無関係なセルを保持する。
- **監査記録**: 書込み前に `BEGIN`、正常な保存・再読込後に `COMMITTED` を `08_変更履歴` へ追記。`BEGIN` のみ残る操作は**手動調査が必要な状態**であり、成功として扱わない。
- **保存確定**: `SpreadsheetApp.flush()` と実セル読戻しを実行してから、実際に保存された値とバージョンをWebへ返す。
- **操作中の保護**: 詳細画面の変更を保存せず閉じる場合、警告後に元の値へ戻す。Escapeキーでも同様に確認し、モーダルを閉じた後は最新データを再取得する。

### 障害発生時に確認する場所

1. Netlify Formsに申込み原本が残っていることを確認する。
2. Apps Script「実行数」を確認する。ログやアラートメールに個人情報を載せない。
3. `08_変更履歴` の `BEGIN` と `COMMITTED` を照合する。同じ受付ID・変更前/後バージョンが対応していないものは途中失敗の候補。
4. 途中失敗の可能性がある場合、Webで安易に再保存せず、対象行の現在値を確認してから復旧する。
5. 不正アクセスが疑われる場合はNetlify側の保存機能をOFFにして秘密値を更新する。本番設定変更はオーナー承認が必要。

**制約**：Google Sheetsへの複数セル更新と監査記録は依然として単一のACIDトランザクションではありません。
監査ジャーナルは失敗発見を補助しますが、自動復旧を保証するものではありません。
本番適用前に、途中失敗時の復旧手順をテストデータで検証してください。

参照: [Google Sheets Apps Script Range](https://developers.google.com/apps-script/reference/spreadsheet/range)
と [Netlify Identity Functions](https://docs.netlify.com/manage/security/secure-access-to-sites/identity/use-identity-in-functions/)。

---

## G. V2.2 統合検証と既存Drive継続運用

### 自動テスト（実サービスには書き込まない）

`tests/diary-ops-workflow.integration.test.mjs` は同じApps Scriptソース
(`diary-netlify-sheets-sync.gs`, `diary-ops-state-webapp.gs`) と
Netlify Functionsを、テスト用のインメモリGoogle Sheets/Netlifyデータで接続します。

検証対象：
- Netlify Forms新規受付1件 → `07_自動受付` → `01_案件ボード` の1件登録。
- 管理者の署名付きGET → 進捗更新POST → Google Sheetsへの永続化相当 → GETによる再取得。
- 5分同期の再試行を模した再実行による重複登録の防止と運用データ保持。
- 古いリビジョンによる更新拒否、無認証リクエストによる更新拒否。
- 完了していない監査ジャーナル（BEGINのみ）を検出したときは、一覧や再保存を停止。
- Web UIでGoogle Sheetsの受付ID未登録・不完全取得・認証失敗のとき、
  進捗・売上を0円や正常な「未対応」と誤認させず、運用機能の編集・CSV出力を停止。

このテストは**模擬環境**です。Netlifyの本番実行、Google Apps Scriptの実行権限、
管理者MFA、実ブラウザの動作、ネットワーク遮断時の復元などを証明するものではありません。

### Google Driveの継続利用（2026-10-22 オーナー承認済み方針）

Google Driveは**現在接続済みの大学Googleアカウントのまま**継続利用します。
新しいアカウントに切り替えたり、元の管理表をコピーしたりしません。
この方針はGoogle Drive接続先・ファイルの選択についてのものであり、
**自動同期の本番有効化、Webアプリ公開、権限変更、APIトークン発行の承認ではありません**。

実運用に向けた安全性チェック：
1. 現在のGoogleアカウントが管理表を操作でき、データ範囲・既存の共有範囲が想定通りであることを確認する。
2. 卒業後やGoogle Workspace管理者のポリシー変更後にアクセス不能になった場合の対応を定める。権限昇格・ポリシー回避はしない。
3. Apps Scriptに秘密値を登録する場合はScript Propertiesを使い、トークンや顧客情報をGitHubに保存しない。
4. 原本の実データには書き込まず、テスト専用の受付でHMAC/未認証/競合/失敗時復元の実環境検証を行う。
5. 本番公開/書込みトリガーは別途オーナー承認後に有効化。初期状態ではすべてOFF。

大学アカウント側のGoogle Drive共有・権限は変更しない。
実環境でGoogle Workspaceの制約によりApps Script Webアプリを配置できない場合は、
**署名なしで公開したり権限の広い別アカウントへ迂回したりせず**、代替接続方式を再設計する。
