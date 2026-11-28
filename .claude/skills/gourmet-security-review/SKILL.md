---
name: gourmet-security-review
description: PR依頼に含まれる個人情報・Netlify/Next.js/GitHubの攻撃面を監査し、変更前にリスクを減らす
---

# gourmet-security-review

## 必須チェック
1. 本番と開発ブランチ・Netlify環境変数の適用先を区別し、未承認の課金・公開・DB変更は禁止。
2. 店舗担当者の氏名・email・相談内容・Netlify Forms受付IDは個人情報。公開ルート、URL、console.log、外部解析、GitHub、NEXT_PUBLIC_* に出さない。
3. データを返す関数はサーバー側で本人認証＋管理者ロール＋許可メールの3条件を検証。未設定・401/403・上流失敗・機能停止時はfail closed。
4. Netlify API tokenはNetlify側のFunctions/Script Properties等の秘密保管場所に限定。顧客ブラウザへ送らない。
5. CSRF・XSS・CSV式注入・SSRF・JSONサイズ・リダイレクト・レート制限・不審ログイン・第三者への共有をレビュー。
6. バックアップ・権限剥奪・インシデント対応・個人情報の削除導線を確認。
7. CIで typecheck/lint/tests/build、関係する認証と拒否条件のテストを実施。Skipsを成功扱いしない。
## 合格条件
脅威モデル、拒否系のテスト結果、本番未反映/反映済、残るリスク、オーナーによる作業を短く報告。
