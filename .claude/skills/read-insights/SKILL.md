---
name: read-insights
description: Read Creators' Instagram/TikTok insights screenshots waiting in GOURMET DIARY and register the numbers as verified performance. Use when asked to "実績スクショを読み取って", process the insights queue, or check pending performance screenshots.
---

# Read insights screenshots

Creators only upload a screenshot of their insights screen. You read it and
register the numbers. No OCR or AI API is involved: you look at the image and
transcribe it.

## Steps

1. `npm run insights -- list`
   Needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SECRET_KEY` in the
   environment. Each waiting screenshot is downloaded to
   `.insights-queue/<evidenceId>.<ext>`.
2. Open each image with the Read tool and transcribe it into a text file,
   one post per line, in the order shown:

   ```
   エリア / 見出し / 閲覧数 / いいね / コメント / リポスト / シェア / 投稿時期
   ```

3. `npm run insights -- submit <evidenceId> <file>` prints a preview.
   Compare it with the image line by line. Then re-run with `--yes`.
4. If the image cannot be read reliably, send it back instead:
   `npm run insights -- reject <evidenceId> "理由（Creatorに表示されます）"`.
5. Report to the user what you registered (creator, posts, total views) or
   sent back, and why.

## Reading the Instagram insights screen

The expected screen is インサイト → コンテンツ → すべてのコンテンツ, 30日間,
sorted by 閲覧数. Each row is one post:

- **エリア**: the small label in the top-left of the thumbnail (e.g. 淡路市, 天王寺).
- **見出し**: the overlay text at the bottom of the thumbnail
  (e.g. 刺身好きなら一度は行きたい). The caption next to the thumbnail is often
  the same for every post (e.g. 「気になったら保存✨」) — do not use it as 見出し.
  Leave 見出し empty if the overlay is unreadable.
- **閲覧数**: the large number on the right. Copy it exactly as displayed:
  `2.7万` stays `2.7万` (stored as an approximate value), `9,786` stays `9,786`.
- **♡ いいね / 💬 コメント / ⟳ リポスト / ➤ シェア**: the four small numbers under the caption, in that order.
- **投稿時期**: the age after the caption (`3週間`, `4日`). Copy as shown.

## Rules

- Never guess a number. If any digit is unclear, reject with a reason such as
  「数字が切れて読めません。全体が写るように撮り直してください」.
- Check that the screen is the 30-day content list. If it is a different
  screen (e.g. account overview only), reject and say which screen to send.
- The measured date is the upload date unless the image clearly shows a
  different date; use `--measured-on YYYY-MM-DD` to correct it.
- If a Creator sends several screenshots of the same list (more than ~8 posts),
  combine them into one file and submit once on the newest evidence; reject the
  others with 「同じ一覧の続きとして登録しました」.
- Screenshots may contain audience data. Do not copy them anywhere else, and
  delete `.insights-queue/` when done.

## Example (グルメ日誌, 2026-10)

```
淡路市 / 刺身好きなら一度は行きたい / 2.7万 / 1,106 / 27 / 12 / 5 / 3週間
小野原 / 漁港直営の新鮮な海鮮定食を堪能 / 2.7万 / 666 / 10 / 6 / 13 / 4日
天王寺 / 開店から行列 人気の一杯 / 2.5万 / 775 / 4 / 7 / 18 / 2週間
難波 / 大和肉鶏・近江鴨 お造り七種盛り / 1.4万 / 602 / 0 / 8 / 17 / 2週間
南淡路 / とにかくボリューム満点 / 1.0万 / 809 / 4 / 6 / 9 / 3週間
松原 / 泡系豚骨 一度は食べたい / 9,786 / 728 / 1 / 4 / 2 / 3週間
本町 / 職人が握る本格鮨を気軽に / 5,975 / 634 / 3 / 4 / 0 / 2週間
北新地 / 旬を揃える天麩羅コース / 5,446 / 618 / 2 / 11 / 0 / 2週間
```
