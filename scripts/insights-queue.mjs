#!/usr/bin/env node
// Queue of Creator insights screenshots waiting to be read.
// Used by Claude (see .claude/skills/read-insights/SKILL.md) or the Operator.
//
//   node scripts/insights-queue.mjs list
//   node scripts/insights-queue.mjs submit <evidenceId> <rows.txt> [--measured-on YYYY-MM-DD] [--yes]
//   node scripts/insights-queue.mjs reject <evidenceId> "<reason shown to the Creator>"
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or
// SUPABASE_SERVICE_ROLE_KEY). Never commit those values.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { parseInsightLines, summarizePerformance, formatCompactViews } from "../lib/creator-performance.ts";

const QUEUE_DIR = ".insights-queue";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY first.");
    process.exit(2);
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function list() {
  const supabase = client();
  const { data, error } = await supabase
    .from("creator_performance_evidence")
    .select("id,platform,measured_on,storage_path,created_at,creator_profiles(display_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) throw error;

  if (!data.length) {
    console.log("No screenshots waiting.");
    return;
  }

  await mkdir(QUEUE_DIR, { recursive: true });
  for (const item of data) {
    const { data: file, error: downloadError } = await supabase.storage
      .from("creator-evidence")
      .download(item.storage_path);
    const extension = item.storage_path.split(".").pop();
    const localPath = `${QUEUE_DIR}/${item.id}.${extension}`;
    if (!downloadError) await writeFile(localPath, Buffer.from(await file.arrayBuffer()));

    const creator = Array.isArray(item.creator_profiles) ? item.creator_profiles[0] : item.creator_profiles;
    console.log(
      [
        `evidence:    ${item.id}`,
        `creator:     ${creator?.display_name ?? "?"}`,
        `platform:    ${item.platform}`,
        `uploaded on: ${item.measured_on}`,
        `image:       ${downloadError ? "(download failed: " + downloadError.message + ")" : localPath}`,
        "",
      ].join("\n"),
    );
  }
}

async function submit(evidenceId, rowsFile, flags) {
  const supabase = client();
  const { data: evidence, error } = await supabase
    .from("creator_performance_evidence")
    .select("id,measured_on,status")
    .eq("id", evidenceId)
    .single();
  if (error) throw error;

  const measuredOn = flags["measured-on"] ?? evidence.measured_on;
  const text = await readFile(rowsFile, "utf8");
  const { rows, errors } = parseInsightLines(text, measuredOn);

  if (errors.length) {
    for (const item of errors) console.error(`line ${item.line}: ${item.reason}\n  ${item.text}`);
    process.exit(1);
  }

  const summary = summarizePerformance(
    rows.map((row) => ({ ...row, platform: "instagram", measuredOn, verified: true })),
    { today: measuredOn },
  );
  console.log(`measured on ${measuredOn}: ${rows.length} posts`);
  for (const row of rows) {
    console.log(
      `  ${row.area} | ${row.headline} | ${row.viewsApprox ? "~" : ""}${row.views} views | ♡${row.likes} c${row.comments} r${row.reposts} s${row.shares} | posted ${row.postedOn}${row.postedOnApprox ? "~" : ""}`,
    );
  }
  if (summary) {
    console.log(`summary: ${summary.highlights.join(" / ")}`);
    console.log(`median ${formatCompactViews(summary.medianViews)}, engagement ${(summary.engagementRate * 100).toFixed(1)}%`);
  }

  if (!flags.yes) {
    console.log("\nPreview only. Re-run with --yes to register these rows as verified.");
    return;
  }

  const { data: count, error: importError } = await supabase.rpc("import_metrics_from_evidence", {
    p_evidence_id: evidenceId,
    p_measured_on: measuredOn,
    p_rows: rows.map((row) => ({
      area: row.area,
      headline: row.headline,
      post_url: row.postUrl,
      posted_on: row.postedOn,
      posted_on_approx: row.postedOnApprox,
      views: row.views,
      views_approx: row.viewsApprox,
      likes: row.likes,
      comments: row.comments,
      reposts: row.reposts,
      shares: row.shares,
      saves: row.saves,
    })),
  });
  if (importError) throw importError;
  console.log(`Registered ${count} posts. The Creator has been notified.`);
}

async function reject(evidenceId, reason) {
  if (!reason) {
    console.error("A reason for the Creator is required.");
    process.exit(1);
  }
  const { error } = await client().rpc("review_performance_evidence", {
    p_evidence_id: evidenceId,
    p_approve: false,
    p_note: reason,
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
  else if (command === "submit" && args.length === 2) await submit(args[0], args[1], flags);
  else if (command === "reject" && args.length >= 2) await reject(args[0], args.slice(1).join(" "));
  else {
    console.log("usage: insights-queue.mjs list | submit <evidenceId> <rows.txt> [--measured-on YYYY-MM-DD] [--yes] | reject <evidenceId> <reason>");
    process.exit(command ? 1 : 0);
  }
} catch (error) {
  console.error(error.message ?? error);
  process.exit(1);
}
