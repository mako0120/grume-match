# グルメ日誌｜Google Sheets案件管理を本番接続する最短手順

> 2026-10-27 / グルメ日誌専用。Google Drive/Sheetの移行なし。
> **コード・モックE2Eは完成。以下のアカウント操作はこのGitHub PR内でまだ実行していません。**
> Netlify Identityの有効化、秘密鍵発行、Apps Scriptウェブアプリ公開、トリガー設置、最終E2Eは管理者による実操作が必須。

## 固定して使うもの

- 本番Web: https://brilliant-custard-364003.netlify.app/diary/ops
- 接続する原本: 今の「グルメ日誌｜PR案件管理ボード」（大学のGoogle Drive）、移行・コピー不要
- Netlify Forms名称: `diary-pr-inquiry`
- 正本: `07_自動受付`（受付）、`01_案件ボード`（運用・金額）、`08_変更履歴`（監査）
- Apps Scriptに配置するのは、**統合済みの1ファイル** `scripts/diary-ops-install-bundle.gs` のみ。
  - 元ソースは `diary-netlify-sheets-sync.gs` / `diary-ops-state-webapp.gs` / `diary-integration-readiness.gs` の3本。
  - `node scripts/build-diary-install-bundle.mjs` で再生成し、CIテストで一致確認。統合版と個別版を**同時に貼り付けない**（関数の二重定義になる）。
- バックアップ機能は別の `scripts/diary-ops-backup.gs`。自動バックアップは初期OFF。
- GitHubとWeb画面に実際のNetlify APIトークンやHMAC秘密値を書かない。Netlify/Apps Scriptの**秘密設定画面だけ**に登録。

## 0. Netlifyの本番サイトを一般公開できる状態にする（P0）

2026-10-27の匿名外部HTTP監査では、`/diary` と `/diary/request` がともに **401** でした。
GitHubのビルド成功だけでは相談窓口は公開できていません。

1. [Netlify Project visibility](https://app.netlify.com/projects/brilliant-custard-364003/configuration/general/#project-visibility) を開く。
2. 一般向けPR紹介・相談サイトを公開する準備が整っている場合のみ、**Production visibility: Public**、**Deploy Previews: Private** を選ぶ。
3. Netlify Identityの管理APIは公開フラグとは独立して認証必須です。プロジェクトをPublicにしても `diary-ops-feed` と `diary-ops-state` の未認証アクセス拒否は維持します。
4. シークレットや個人情報を含むテスト用プレビューは非公開のままにする。
5. 変更後は**ログアウト状態/シークレットウィンドウ**で`/diary` と `/diary/request` のHTTP200、および管理APIのHTTP401/503を確認する。
6. もしすでにProductionがPublicなのに401なら、サイト保護/SSO/IPフィルターなど別の訪問者アクセス制御を調査し、無条件に保護を全面解除しない。

ここでの**Netlifyの管理画面操作はGitHubからは実行できず、所有者本人による操作が必要**です。

## 1. 既存Google SheetsでApps Scriptを設定

1. 大学Googleアカウントで既存の管理表を開き、拡張機能 → Apps Script を選択。
2. GitHubの `scripts/diary-ops-install-bundle.gs` の内容をコピーし、既存のApps Scriptプロジェクトの**単一ファイルへ貼り付ける**。過去の同名関数を含む古いコードは別途控えを保存した上で整理し、個別版との重複配置を避ける。
3. プロジェクトの設定 → スクリプト プロパティ:
   - `SPREADSHEET_ID`: **現在の管理表のID**（URLの `/d/…/edit` 部分）。
   - `NETLIFY_API_TOKEN`: Netlifyユーザー設定で発行した、保護された個人アクセストークン。
   - `NETLIFY_SITE_ID`: NetlifyのGeneral settingsで表示される **Site API ID（UUID形式）**。サイト名ではない。
   - `DIARY_SHEETS_HMAC_SECRET`: 十分強い32文字以上のランダムな秘密値。次項のNetlify環境変数と**完全一致**させる。
   - `DIARY_BOARD_AUTOCREATE_ENABLED=true`：確認済み受付を案件ボードに自動登録する許可。
   - `DIARY_INTEGRATION_APPROVED` は**まだ設定しない**。
4. Apps Scriptで `checkDiaryIntegrationReadiness()` を手動実行。顧客情報・シークレット値は返さず、シート見出し・監査ログ・Secret設定・トリガー・最終成功の**状態だけ**を表示。
5. `verifyDiaryNetlifyConnection()` を手動実行。Netlify APIの**フォーム一覧だけ**読み、正規フォームが一意に存在することを確認（顧客データやシートは読書きしない）。
6. 既存のバックアップと原本の権限を確認。大学Workspace管理者が外部APIまたはWebアプリ公開を禁止している場合は**回避せず停止**。

## 2. Netlify Identity（オーナー限定のログイン）

1. Netlifyのプロジェクトの Identity を有効化。Registrationは **Invite only**。
2. 実際の運営者メールアドレスを招待する。**招待メールのリンクから公開サイトに戻ると、初期パスワード設定画面が表示される**（2026-10-27に`@netlify/identity`公式SDKで実装）。リンクを共有・転載しない。
3. 初期パスワードを設定してログイン可能になったら、そのIdentityユーザーへ`admin`ロールを付与。Netlifyサイトのチーム管理者とIdentityユーザーの`admin`ロールは別概念です。Google Sheets所有者メールと一致させる必要はありません。
4. `/diary/ops` に管理者メール・パスワードでログインする。ログイン失敗時の**「パスワードを再設定」**から届くメールのリンクでも設定画面へ戻れます。
5. 未認証401・別メール/非admin403・トークン期限切れ・ログアウトの動作を確認。Netlifyチーム管理者とGoogleアカウントには利用可能なMFAを設定。
4. Netlify環境変数のProduction設定（Netlify Functionsが読めるサーバー側。**NEXT_PUBLIC_を付けない**）:
   - `DIARY_OPS_OWNER_EMAIL`: 上記で登録したIdentity管理者メール
   - `DIARY_NETLIFY_SITE_ID`: 同じSite API ID
   - `DIARY_NETLIFY_API_TOKEN`: 同じNetlify APIトークン
   - `DIARY_SHEETS_HMAC_SECRET`: Apps Scriptと**同一**のHMAC秘密値
   - `DIARY_SHEETS_WEBAPP_URL`: 次の手順で得られる `https://script.google.com/macros/s/…/exec` のURL
   - `DIARY_OPS_AUTO_SYNC_ENABLED`: 最終検証後 `true`
   - `DIARY_OPS_STATE_ENABLED`: 最終検証後 `true`

**重要:** 環境変数だけを入力してもNetlifyでは再デプロイが必要になる場合があります。
値を設定した後、Productionデプロイの新しい状態を確認すること。
Deploy PreviewでのパスとProductionは別に考える。

## 3. Apps Script保存Webアプリを配置する

- コードに `diary-ops-state-webapp.gs` が含まれることを確認。
- Apps Script → デプロイ → 新しいデプロイ → ウェブアプリ。
- 「実行ユーザー」は**自分**。Google Workspaceのルール上許可される場合のみ、アクセスは「全員」を選択できる。匿名URLから起動できるため、HMACを**先に設定し、署名なしで運用しない**。
- 発行された `/exec` URLをNetlifyの `DIARY_SHEETS_WEBAPP_URL` に登録。URLはGitHubやブラウザJSに置かない。
- サイト本体から呼ぶのはNetlify Functionsだけ。フォーム利用者にApps ScriptのURLやHMACを公開しない。

## 4. 既存の管理表への定期取込を有効化

次の条件を満たした**後**、Script Propertiesで `DIARY_INTEGRATION_APPROVED=true` にし、
Apps Scriptエディタから `activateDiaryIntegration()` を手動で一度実行します。

- ✅ 既存の管理表に3タブが揃う / 監査6列が一致
- ✅ 受信データ・手入力データが消えないバックアップが検証されている
- ✅ シークレット2種類・Site API ID・既存スプレッドシートIDが正しい
- ✅ `verifyDiaryNetlifyConnection()` が成功する
- ✅ Apps ScriptをWebアプリとして公開できるGoogle Workspace上の権限がある

この関数は事前検証→Netlifyの読み取り→同期の初回実行→**5分トリガー1個**の確認まで行います。
実行前に不備があれば書き込みを始めません。同期成功後、
`checkDiaryIntegrationReadiness()` の `running=true` と `triggerCount=1` を確認してください。

緊急停止は `stopDiaryIntegration()`。元データは削除しません。Web側も
`DIARY_OPS_STATE_ENABLED=false` と `DIARY_OPS_AUTO_SYNC_ENABLED=false`
で更新を止めます。

## 5. 本番実環境で合格判定する

本番サイトの `/diary/ops` にNetlify Identity管理者でログインしたあと、
**実在しないテスト用の店舗名・メール**の送信を1件用意して次の項目を照合します。

1. Netlify Formsの受付原本が1件増える。
2. 約5分以内に `07_自動受付` に同じIDが1件、`01_案件ボード` に同じIDが1件。再同期しても2件にならない。
3. Webに一覧が表示され、ステータス・次の対応・期限・見積・着金額を変更して「Google Sheetsに保存」を実行。
4. Sheetsの編集列に反映され、Webを再読込しても値が一致。`08_変更履歴` にBEGINとCOMMITTEDが対になる。
5. 未認証401、別ユーザー403、不正署名、古いrevision409、API失敗時の保存拒否を確認。
6. Netlify Forms・Web・Sheetの受付ID全件と金額が一致することを確認。500件を超える受付は現行UIの対象外。
7. 現在の同一Drive内バックアップで隔離した復旧試験を行う。**原本をテストで上書きしない**。

すべて成功したときだけ案件管理Webを稼働中と判断。
CI・Deploy Preview成功、あるいは `running=true` の**どちらか片方のみでは商用本番の合格にはならない**。

## トラブルシュート

| 症状 | 確認対象 |
|---|---|
| `sheet_schema` / `audit_schema` NG | Apps Scriptの既存表ID・スクリプトの所属・A1:N1/C5/D5/U5/A1:F1見出し |
| `netlify_site_id` / `netlify_token` NG | Site API IDがサイト名でないか、TokenがScript Propertiesにあるか |
| API接続テスト失敗 | Netlifyトークンの有効性、Netlify Formsの名称、Workspaceの外部通信ポリシー |
| トリガーが0または複数 | 同期未起動 / 複数設置を除去して再セットアップ |
| `recent_sync_success` NG | Apps Script「実行数」の権限・クォータ・Netlify APIの応答 |
| Web保存が503 | Netlifyの有効化フラグ/Identity/FunctionsとGoogle WebアプリURL |
| Web保存が409 | 他編集者との競合、監査BEGIN未完了。無理に再保存しない |
| Webで受付が表示されても金額「未取得」 | Boardへの自動登録が追いついていない、IDの不一致、500件超過 |
