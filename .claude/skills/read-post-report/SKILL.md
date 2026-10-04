---
name: read-post-report
description: Read Creators' insights screenshots of individual PR posts in GOURMET DIARY and register views, reach, saves etc. as the Restaurant's verified post report. Use when asked to "投稿レポートを読み取って", process the post report queue, or check pending PR post screenshots.
---

# Read PR post reports

After a PR post has been up for about a week, the Creator sends one
screenshot of that post's insights. You read it and register the numbers.
The Restaurant sees them as 「運営確認済み」 with the cost per 1,000 views.
No OCR or AI API is involved: you look at the image and transcribe it.

## Steps

1. `npm run post-reports -- list`
   Needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY`. Each waiting
   screenshot is downloaded to `.insights-queue/post-<reportId>.<ext>`.
2. Open each image with the Read tool.
3. Preview what you read:

   ```
   npm run post-reports -- submit <reportId> --views 12,400 --reach 9,800 \
     --likes 640 --comments 12 --saves 310 --shares 45 --follows 28
   ```

   Pass only the numbers that are on the screen. `--views` is required.
   Copy numbers exactly as displayed (`1.2万` is accepted and stored as 12,000).
4. Compare the preview with the image number by number, then re-run with `--yes`.
5. If the image cannot be read reliably, send it back:
   `npm run post-reports -- reject <reportId> "理由（Creatorに表示されます）"`.
6. Report what you registered (creator, restaurant, views, cost per 1,000
   views) or sent back, and why. Delete `.insights-queue/` when done.

## Reading the Instagram post insights screen

The expected screen is the post → 「インサイトを見る」.

| Screen label | Flag |
|---|---|
| 閲覧数 / 再生数 (Views, Plays) | `--views` |
| リーチしたアカウント数 / 閲覧したアカウント (Accounts reached) | `--reach` |
| いいね！ (heart) | `--likes` |
| コメント | `--comments` |
| 保存数 (bookmark) | `--saves` |
| シェア数 (paper plane) | `--shares` |
| フォロー数 (Follows) | `--follows` |

## Rules

- Never guess a number. If a digit is unclear, reject with e.g.
  「数字が切れて読めません。インサイト画面全体が写るように撮り直してください」.
- Check that it is the insights of **this** PR post: the thumbnail or caption
  should match the restaurant in the list output. If it is the account
  overview or a different post, reject and say which screen to send.
- Reach (people) can never exceed views; the command refuses it. Re-check
  the image instead of forcing it.
- `--measured-on` defaults to today (Asia/Tokyo). Use the date on the
  screenshot if it clearly shows an earlier one.
- Screenshots may contain audience data. Do not copy them anywhere else.
