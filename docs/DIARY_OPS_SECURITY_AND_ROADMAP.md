# グルメ日誌｜案件管理 Web V3 と情報漏洩対策（2026-10）

## 現在の構成

- 公開サイトのNetlify Formsは現行のまま。実際のPR申込みとGmail通知は稼働中。
- グルメ日誌のGoogle Sheets管理ボードは、ホーム、スマホ確認、案件ボード、カンバン、要対応、来店・投稿、請求・入金、運用ガイド、セキュリティ点検を用意。
- スプレッドシートの自動計算セルには編集前の警告を設定。期限警告・進捗・未収計算の連動はテスト済み。
- Web管理コンソール（/diary/ops）は開発ブランチ上で実装。まだNetlify本番の公開ブランチにマージしていない。

## Webのセキュリティ境界

管理画面はユーザーが選択したNetlify CSVを **ブラウザ内メモリでのみ処理**。サーバーへ顧客情報をPOSTしない。新たなサーバーDBや認証トークンを使わず、localStorage・sessionStorage・Cookieにも顧客情報を書かない。画面はログイン保護されていないため、誰でも空の画面に入れるが、他者の顧客情報を取得するサーバーAPIは存在しない。利用者自身が入力したCSVだけが表示される。

編集情報は揮発性。必ず「CSVを書き出す」で暗号化された適切な保存先へバックアップしてください。CSVには実在する担当者名・メールアドレスが含まれるため、公共PC・共同端末・公開フォルダでは使用しないこと。

対策実装： noindex / noarchive / Cache-Control private no-store / no-referrer / same-origin通信 / CSV数式インジェクション対策 / 入力ファイルサイズと最大件数制限 / 重複受付IDの排除 / Reactによるテキストエスケープ。Stripe・請求書・顧客メールへの自動操作なし。

## Google Sheetsのデータ権限

Google Drive APIの共有権限確認（2026-10-21時点）では大学アカウントが所有者、グルメ日誌専用Gmailが編集者の **2アカウントのみ**。一般公開設定なし。

長期運用では学生アカウント依存が危険です。実際の顧客情報を登録する前にグルメ日誌専用Gmailにサインインし、Google Sheetsの「ファイル → コピーを作成」を使い、所有者も専用Gmailのファイルに切り替えてください。別ドメインの所有権移転は通常制限があるため直接移転は保証しません。

## 今後の自動取込版（未実装）

Netlify Formsを直接取得するにはサーバー認証が必要。ブラウザへ Netlify Personal Access Tokenを渡す方法は不可。

Netlify Identityは2026年現在公式に継続サポート。Identityの招待のみ登録（Invite only）で専用Gmailのみ招待し、MFAを有効化したGoogle OAuthを利用、サーバーサイドのNetlify Functionで毎回getUserとadminロールを検証する。Netlify APIトークンはサーバー側のNetlify環境変数にのみ保存。フォームのID限定＋ページネーション＋エラー時fail closedを実装し、保存データは認可済みDBに分離する。操作監査・アクセス停止・レート制限・CSRF・バックアップ/復元検証を済ませて本番運用すること。

オーナーの操作が必要：Netlify Identity有効化、Invite only選択、本人の招待、admin権限付与、サーバー用API資格情報の発行。本手順が完了するまでは自動取込を稼働させない。

## 一次資料

- https://docs.netlify.com/manage/security/secure-access-to-sites/identity/overview/
- https://docs.netlify.com/manage/security/secure-access-to-sites/identity/use-identity-in-functions/
- https://docs.netlify.com/manage/security/secure-access-to-sites/identity/registration-login/
- https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/
- https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
