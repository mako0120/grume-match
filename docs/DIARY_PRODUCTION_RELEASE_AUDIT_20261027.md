# グルメ日誌｜本番導入・情報保護検証記録（2026-10-27）

## 判定

**コード: 安全対策の実装・模擬E2Eを検証済み。一般向けサイト公開とSheets本番連携: No-Go（ブロッカーあり）。**

- 本番 Netlify サイト: `https://brilliant-custard-364003.netlify.app`
- 本番ソースブランチ: `feat/gurume-diary-direct-pr`
- Google Drive/Sheets: 接続済みの既存大学アカウントと既存案件管理ボードを継続。
- Netlify Identity・Apps Script Webアプリ設定・Secrets・トリガーはGitHubコネクタから変更できない。本資料はそれらの有効化を主張しない。
- 顧客情報を含む原本やGoogle Drive共有権限は今回変更していない。

## P0 — 公開URLが匿名から401を返す（確認済み）

2026-10-27、GitHub Actions上の認証情報なしHTTPクライアントから読取り専用GETで測定。

| パス | HTTP | 判定 |
| --- | --- | --- |
| `/diary` | 401 | **公開案内LPとしてNG** |
| `/diary/request` | 401 | **一般申込み受付としてNG** |
| `/diary/ops` | 401 | 管理画面シェルは401。設計によっては可 |
| `/.netlify/functions/diary-ops-feed` | 401 | 未認証アクセス拒否として適切 |

- 応答ServerヘッダーはNetlify、公開3ページには `WWW-Authenticate` はない。原因は**未特定**。サイト全体のパスワード保護・訪問者制限・プロキシ・デプロイ保護などの可能性。HTTP401だけで実際のNetlify設定を断定しない。
- 検証記録：GitHub Actions「Diary production HTTP smoke (read-only, one-shot)」Run #1, #2、後者のURL `https://github.com/mako0120/grume-match/actions/runs/40475546928`。
- **次の操作**：サイトオーナーがNetlifyプロジェクトの訪問者アクセス・保護/ロール設定を調べる。一般向け `/diary` と `/diary/request` のみ認証なしHTTP200になることを外部環境で確認する。管理APIは引き続き未認証401/503とする。
- 防御を無条件に全面解除しない。ログイン必須の管理APIを公開しない。Netlify設定の変更はアカウントオーナーの明示操作を要する。
- 今回の検査は**ページのHTTPアクセスと匿名APIのみ**。フォームの実際の送信・通知・管理者ログイン・実データ保存のE2Eを保証しない。

## P0 — 依存関係の重大脆弱性を修正

- 2026-10-27の `npm audit --omit=dev --audit-level=high` が Next.js `16.3.8` のcritical/highアドバイザリを検出し、CIが失敗。主な監査ID：
  - `GHSA-2464-fhr4-w9xw`（SVG画像最適化関連のRCE）
  - `GHSA-673q-mjm6-r5xr`（use cache）
  - `GHSA-p3m5-59mp-jv5r`（Server Actions DoS）
- Next.js・eslint-config-nextを `16.4.3` に固定し、npm公式の解決処理で `package-lock.json` を再生成。
- GitHub Actionsで `npm ci`、production高/重大監査、型チェック、Lint、全自動テスト、ビルドが成功した場合だけ依存関係変更をコミット。
- 実装用の一時的な書込み権限ワークフローは完了後**削除**。Dependabotを週1回起動し、npm/GitHub Actions更新PRを少数に制限する設定を追加。
- 改善で将来の脆弱性がすべて消える保証はない。CIの `npm audit` を継続する。

## P1 — 案件管理の不整合・誤操作防止

- 変更履歴の `BEGIN` / `COMMITTED` を**順序付き**に検証し、孤立COMMITTED/逆順/重複BEGIN/不正バージョンを拒否。コピー貼付け用Apps Script統合ファイルにも同じ修正を反映。
- 管理者ログイン中は、CSVを混入させる処理をUIと関数の双方で拒否。
- Sheets未接続時は詳細画面や関数からのCSV出力・金額保存の抜け道を防止。
- サイドバー表示をライブ接続の有無に応じて修正、受付0件表示を区別、画面移動・手動ログアウトで未保存編集の警告を追加。
- すべてテスト用の合成データ・モックで検証。実顧客のSheet行やNetlify Formsには書き込んでいない。

## Web案件管理の実運用開始に残る作業

1. 大学Googleアカウントの既存管理表で `scripts/diary-ops-install-bundle.gs` を既存Apps Scriptに貼付け、重複関数を排除。
2. Script Propertiesの Netlify API token、Site API ID、`SPREADSHEET_ID`、HMAC秘密値（実値はチャット/GitHubに貼らない）を設定。
3. Netlify Identityの招待制・adminロール・管理者メール、Functions秘密値を設定。実管理者以外401/403を検証。
4. 既存Google Sheetsのプライベートバックアップを確認し、`activateDiaryIntegration()` を管理者本人が実行、トリガー1個・5分以内の取込みを確認。
5. テスト用の架空店舗から Netlify Forms → `07_自動受付` → `01_案件ボード` → Web編集 → `08_変更履歴` → Web再読込までE2E。失敗時は `stopDiaryIntegration()` とNetlify側フラグOFF。
6. 障害復元・アクセス遮断・大学アカウント利用資格終了時のデータ保管方針を確認。プライベートな同一Driveバックアップはアカウント停止に対する独立復旧策ではない。

導入手順書：[DIARY_ACTIVATION_ONE_PAGE.md](./DIARY_ACTIVATION_ONE_PAGE.md)。

## 参考ソース

- GitHub Advisory GHSA-2464-fhr4-w9xw: https://github.com/advisories/GHSA-2464-fhr4-w9xw
- GitHub Advisory GHSA-p3m5-59mp-jv5r: https://github.com/advisories/GHSA-p3m5-59mp-jv5r
- Netlify Visitor access docs: https://docs.netlify.com/manage/security/secure-access-to-sites/visitor-access/
