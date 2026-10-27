# グルメ日誌｜案件管理 Web と情報漏洩対策（2026-10-22 更新）

## 利用中の構成と公開状態

- 公開サイトはNetlify FormsでPR相談を受け付ける。受付原本はNetlify。
- 現在のGoogle Drive（大学アカウント）と既存の「グルメ日誌｜PR案件管理ボード」を**継続利用**する。別アカウントへの所有権変更・共有範囲変更・移行用コピーはしない。
- `/diary/ops` 管理画面・Netlify Functions・Apps Scriptの自動連携と永続化はGitHubの開発ブランチ・Draft PR #23に実装済み。ただし本番用のIdentity・API秘密値・実運用のApps Script設定はまだ有効化していない。
- コード上の機能フラグは既定OFF。実環境で認証・復元・権限確認が終わる前に商用利用可能とは判定しない。

## WebとGoogle Sheetsの権限境界

- CSVモードは端末内メモリのみ。自動モードはNetlify Identityの本人＋adminロール照合を毎回実施し、秘密のNetlifyトークンはサーバー側の環境変数のみ保持する。
- Netlify Formsの受付IDとGoogle Sheetsの案件ボードを照合し、不完全な同期を0件/0円として誤表示しない。
- 進捗は保存機能が有効な場合のみ明示保存し、HMAC署名、nonce再利用拒否、楽観ロック、フィールド許可リスト、監査BEGIN/COMMITTEDの整合性を確認する。
- 原本にアクセス可能なGoogleアカウントがApps Scriptを実行する。Workspace管理者の制限を回避しない。Netlify Identityの管理メールはGoogle Sheets所有者と一致させる必要はない。
- シートの共有設定・アクセス期限はオーナーが定期確認する。卒業後に大学Googleアカウントが使えなくなるリスクは継続。

## バックアップと復旧

- `scripts/diary-ops-backup.gs` に、読取専用点検と明示承認時の同一Drive内プライベートコピー、読取専用の復元差分確認を実装。
- **現時点でコピー作成や原本の書換えは実施していない**。トリガーも自動では設置しない。
- 複製されたバックアップにも担当者名・メール・売上情報が含まれる。個別共有や一般公開を禁止し、フォルダのアクセス管理を慎重に行う。
- 同じ大学アカウント内のバックアップはGoogleアカウント失効・組織全体障害に対する独立した復旧手段にならない。別保管先への暗号化エクスポートは大学の規定とオーナーの別途承認が必要。
- 復元は自動で原本へ上書きしない。隔離されたテスト環境で作成データ/請求/入金/監査を検証し、復旧対象・時点を確認してからオーナーが判断。

詳しい運用手順: [DIARY_AUTO_SYNC_ACTIVATION.md](./DIARY_AUTO_SYNC_ACTIVATION.md)、
[DIARY_BACKUP_RECOVERY.md](./DIARY_BACKUP_RECOVERY.md)。

## 重要な残余リスク

- 大学アカウントの有効期限・Workspace管理者ポリシーによるApps Script実行制約。
- Apps Script Webアプリ公開面、Netlify IdentityのMFA/失効、トークン権限。
- Google Sheetsには複数セルと監査記録を一体化したACIDトランザクションがない。
- フォーム500件・案件1,000行・バックアップ走査150,000セルの上限。
- バックアップが同じアカウント内のため、独立復旧性には限界がある。

## 一次資料

- https://developers.google.com/apps-script/reference/drive/file
- https://developers.google.com/apps-script/reference/drive/folder
- https://developers.google.com/apps-script/guides/web
- https://docs.netlify.com/manage/security/secure-access-to-sites/identity/overview/
- https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
