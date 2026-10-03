#!/usr/bin/env node
// Queue of PR post insights screenshots waiting to be read.
// Used by Claude (see .claude/skills/read-post-report/SKILL.md) or the Operator.
//
//   node scripts/post-report-queue.mjs list
//   node scripts/post-report-queue.mjs submit <reportId> --views 12,400 [--reach 9,800]
//       [--likes 640] [--comments 12] [--saves 310] [--shares 45] [--follows 28]
//       [--measured-on YYYY-MM-DD] [--yes]
//   node scripts/post-report-queue.mjs reject <reportId> "<reason shown to the Creator>"
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or
// SUPABASE_SERVICE_ROLE_KEY). Never commit those values.
import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { costPerThousandViews, parseInsightCount } from "../lib/pr-feedback.ts";
import { platformFee } from "../lib/pricing.ts";

const QUEUE_DIR = ".insights-queue";
const metrics = ["views", "reach", "likes", "comments", "saves", "shares", "follows"];

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY first.");
    process.exit(2);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function one(value) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function todayInTokyo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
}

async function list() {
  const supabase = client();
  const { data, error } = await supabase
    .from("pr_post_reports")
    .select(
      "id,storage_path,submitted_at,creator_profiles(display_name),deliverables(platform,submitted_url),bookings(campaigns(title,restaurants(name)))",
    )
    .eq("status", "pending")
    .order("submitted_at", { ascending: true })
    .limit(20);
  if (error) throw error;

  if (!data.length) {
    console.log("No post reports waiting.");
    return;
  }

  await mkdir(QUEUE_DIR, { recursive: true });
  for (const item of data) {
    const { data: file, error: downloadError } = await supabase.storage
      .from("creator-evidence")
      .download(item.storage_path);
    const extension = item.storage_path.split(".").pop();
    const localPath = `${QUEUE_DIR}/post-${item.id}.${extension}`;
    if (!downloadError) await writeFile(localPath, Buffer.from(await file.arrayBuffer()));

    const deliverable = one(item.deliverables);
    const campaign = one(one(item.bookings)?.campaigns);
    console.log(
      [
        `report:      ${item.id}`,
        `creator:     ${one(item.creator_profiles)?.display_name ?? "?"}`,
        `restaurant:  ${one(campaign?.restaurants)?.name ?? "?"} / ${campaign?.title ?? "?"}`,
        `post:        ${deliverable?.platform ?? "?"} ${deliverable?.submitted_url ?? ""}`,
        `sent at:     ${item.submitted_at}`,
        `image:       ${downloadError ? "(download failed: " + downloadError.message + ")" : localPath}`,
        "",
      ].join("\n"),
    );
  }
}

async function submit(reportId, flags) {
  const values = {};
  for (const name of metrics) {
    if (flags[name] === undefined) continue;
    const parsed = parseInsightCount(flags[name]);
    if (parsed === null) {
      console.error(`--${name} "${flags[name]}" is not a number as shown on the screen.`);
      process.exit(1);
    }
    values[name] = parsed;
  }
  if (values.views === undefined) {
    console.error("--views is required.");
    process.exit(1);
  }
  if (values.reach !== undefined && values.reach > values.views) {
    console.error("reach cannot exceed views. Check the screenshot again.");
    process.exit(1);
  }

  const supabase = client();
  const { data: report, error } = await supabase
    .from("pr_post_reports")
    .select("id,status,booking_id,bookings(payments(amount),campaigns(cash_reward)),creator_profiles(display_name)")
    .eq("id", reportId)
    .single();
  if (error) throw error;
  if (report.status !== "pending") {
    console.error(`This report is ${report.status}, not pending.`);
    process.exit(1);
  }

  const measuredOn = flags["measured-on"] ?? todayInTokyo();
  const booking = one(report.bookings);
  const payment = one(booking?.payments)?.amount ?? one(booking?.campaigns)?.cash_reward ?? 0;
  const { data: feeRow } = await supabase
    .from("platform_fees")
    .select("fee")
    .eq("booking_id", report.booking_id)
    .maybeSingle();
  // PR cost as the Restaurant sees it: Creator payment + platform fee.
  const cost = payment + (feeRow?.fee ?? platformFee(payment));

  console.log(`${one(report.creator_profiles)?.display_name ?? "?"} — measured on ${measuredOn}`);
  for (const name of metrics) console.log(`  ${name.padEnd(8)} ${values[name]?.toLocaleString("ja-JP") ?? "—"}`);
  const cpm = costPerThousandViews(cost, values.views);
  console.log(`  cost ¥${cost.toLocaleString("ja-JP")} → ¥${cpm?.toLocaleString("ja-JP") ?? "—"} per 1,000 views`);

  if (!flags.yes) {
    console.log("\nPreview only. Compare with the image, then re-run with --yes.");
    return;
  }

  const { error: importError } = await supabase.rpc("import_pr_post_report", {
    p_report_id: reportId,
    p_measured_on: measuredOn,
    p_views: values.views,
    p_reach: values.reach ?? null,
    p_likes: values.likes ?? null,
    p_comments: values.comments ?? null,
    p_saves: values.saves ?? null,
    p_shares: values.shares ?? null,
    p_follows: values.follows ?? null,
  });
  if (importError) throw importError;
  console.log("Registered. The Creator and the Restaurant have been notified.");
}

async function reject(reportId, reason) {
  if (!reason) {
    console.error("A reason for the Creator is required.");
    process.exit(1);
  }
  const { error } = await client().rpc("reject_pr_post_report", {
    p_report_id: reportId,
    p_reason: reason,
  });
  if (error) throw error;
  console.log("Sent back to the Creator.");
}

const [command, ...rest] = process.argv.slice(2);
const flags = {};
const args = [];
for (let index = 0; index < rest.length; index += 1) {
  if (rest[index] === "--yes") flags.yes = true;
  else if (rest[index].startsWith("--")) flags[rest[index].slice(2)] = rest[++index];
  else args.push(rest[index]);
}

try {
  if (command === "list") await list();
  else if (command === "submit" && args.length === 1) await submit(args[0], flags);
  else if (command === "reject" && args.length >= 2) await reject(args[0], args.slice(1).join(" "));
  else {
    console.log(
      "usage: post-report-queue.mjs list | submit <reportId> --views N [--reach N --likes N --comments N --saves N --shares N --follows N --measured-on YYYY-MM-DD] [--yes] | reject <reportId> <reason>",
    );
    process.exit(command ? 1 : 0);
  }
} catch (error) {
  console.error(error.message ?? error);
  process.exit(1);
}
