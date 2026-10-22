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
