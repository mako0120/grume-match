# グルメ日誌｜大阪 — Netlify Forms 本番申込み受付

対象サイト: https://brilliant-custard-364003.netlify.app/diary
GitHub: `mako0120/grume-match` の `feat/gurume-diary-direct-pr`

## 今回の実装（Supabase契約不要）

- 利用者向け：`/diary/request` の **無料相談・PR申込みフォーム**。店舗名、担当者、返信用メール、ご希望プラン、相談内容、任意の紹介メニューと候補日時、2種類の同意確認。
- データ保存：Netlify標準の Forms（サイト管理画面 `Forms` → `diary-pr-inquiry`）。バックエンド契約、Stripe、外部データベースは不要。
- セキュリティ：Netlify Akismetスパムフィルターと honeypot `bot-field`、通信HTTPS、入力上限、Client側の禁止案件チェック。**Client検証は改ざんされるためサーバーの審査の代わりにはならない**。Netlify管理画面の相談を1件ずつ人間が審査してから受注する。特定の評価・対価付き口コミ・ステルスマーケティングは受け付けない。
- 保存されるPII：店舗・担当者名、メール、PR希望内容など。Netlifyのアクセス権を制限し、定期的に不要な問い合わせを削除。追加の追跡Cookieや外部広告SDKは不要。
- `public/__forms.html` に、Netlifyがビルド時に検出できる静的HTMLのフォーム定義を置く。Next.jsで通常のReactコンポーネントに `data-netlify` を足すだけではフォーム検出されない。手動操作ではなくAJAXで **`POST /__forms.html`** にURLエンコード送信する。
- 保存先が有効でない間に問い合わせを失わないため、`DIARY_NETLIFY_FORMS_ENABLED=true` が設定されたNetlify本番のみ、Netlifyフォームを表示する。未設定は従来のInstagram DM相談を表示。
- 既存のSupabase/Turnstileベースの案件ワークフロー（承認→日程→請求）は**別系統として未有効**。Netlify Formsの受付ではフォーム送信は契約成立ではなく、管理者が手動で見積もり・メール返信する。
- 問い合わせの通知はNetlify標準の `Forms > Submission notifications` でオーナー自身が安全な受信アドレスを設定する。アドレスをコードに埋め込まない。
- 現状の送信成功画面は、HTTP応答を受けた後にのみ表示。Netlifyフォームの有効化・登録漏れによる誤判定の可能性はゼロではないため、**テスト送信がNetlify管理画面に現れるまで完了扱いにしない**。

## オーナーがNetlify管理画面で行う操作

1. [Netlify dashboard](https://app.netlify.com) → サイト **brilliant-custard-364003** → **Forms** → **Enable form detection**。すでにオンならそのまま。
2. Site configuration → **Environment variables** から **`DIARY_NETLIFY_FORMS_ENABLED=true`** をNetlify **Production** 環境に追加。GitHubへシークレットを記載しない。
3. サイト **Deploys** → **Trigger deploy** → **Deploy site** で再デプロイ。公開ブランチは `feat/gurume-diary-direct-pr`。GitHub commit SHA が最新と一致し、Deploy status が Published になったことを確認する。
4. **Forms** を開いて、フォーム名 **`diary-pr-inquiry`** が Active forms に検出・登録されていることを確認。見つからなければ、Form detectionの有効化タイミングが遅かった可能性があるため、もう一度再デプロイ。セキュリティゲート `DIARY_NETLIFY_FORMS_ENABLED` は無理に有効化せず先に検出を確認してもよい。
5. **Forms > Submission notifications** でEmail notificationを追加し、通知先の安全な受信メールをオーナーが指定（メールアドレスをこのリポジトリやチャットに貼らない）。
6. `https://brilliant-custard-364003.netlify.app/diary/request?intent=consultation` を開き、自分で作ったテスト内容（実在する自分の店舗名・メールなど）を使って1件だけ送信する。フォームが表示されなければ、環境変数と最新デプロイを確認。
7. **Forms → diary-pr-inquiry → Verified submissions** でテストが確認できるか、通知メールを受け取れるかを両方検証する。見当たらなければ `Spam submissions` も確認する。**管理画面に記録されない限り本番稼働を宣言しない**。
8. 運営者情報・プライバシーポリシー・連絡先・発信内容を最終確認し、必要に応じて修正。フォームは無料相談で、契約・請求はメールによる人間の合意後のみ。

## 運用上の限界

- Netlify標準のForm通知は受信側へ通知するもので、**応募者への自動返信や返信メール配信は実装していない**。受信後、運営者自身のメールから返信する。
- ログイン付き管理画面 `/admin/diary-inquiries` はSupabase版のみを対象とし、Netlify Formsの内容はそこに反映されない。NetlifyのFormsダッシュボードを使う。
- Netlifyフォームのクライアント検査は不正なHTTPリクエストで回避できる。違反PRの自動受注・自動請求はしない。受注審査を徹底する。
- Netlifyの契約種別がクレジット制であればForm submissionsは無制限・追加クレジット不要（2026-10時点の公式仕様）。レガシープランでは課金形態が異なるため管理画面で事前に確認する。**デプロイ自体にはクレジットが発生することがある**。

### 一次資料

- https://opennext.js.org/netlify/forms
- https://docs.netlify.com/manage/forms/setup/
- https://docs.netlify.com/manage/forms/notifications/
- https://docs.netlify.com/manage/forms/submissions/
- https://docs.netlify.com/manage/forms/spam-filters/
- https://docs.netlify.com/manage/forms/usage-and-billing/
