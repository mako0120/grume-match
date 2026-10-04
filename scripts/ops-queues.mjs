#!/usr/bin/env node
// Every operations queue in one place, for the Operator team (people or
// Claude agents). Each queue names its owner role and the next command.
// See docs/OPERATIONS.md for what each role does.
//
//   node scripts/ops-queues.mjs                 summary of all queues
//   node scripts/ops-queues.mjs <queue>         items of one queue
//   node scripts/ops-queues.mjs followed-up <reviewId>   close a low-rating follow-up
//   node scripts/ops-queues.mjs fee-status invoiced|paid <feeId...>
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or
// SUPABASE_SERVICE_ROLE_KEY). Never commit those values.
import { createClient } from "@supabase/supabase-js";

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

const day = 24 * 60 * 60 * 1000;
const ago = (days) => new Date(Date.now() - days * day).toISOString();

// role: who works the queue (docs/OPERATIONS.md). next: what to run / do.
const queues = {
  insights: {
    role: "実績読み取り",
    next: "npm run insights -- list",
    load: (db) =>
      db
        .from("creator_performance_evidence")
        .select("id,created_at,creator_profiles(display_name)")
        .eq("status", "pending")
        .order("created_at")
        .limit(50),
    describe: (row) => `${one(row.creator_profiles)?.display_name ?? "?"}`,
    at: (row) => row.created_at,
  },
  "post-reports": {
    role: "投稿レポート読み取り",
    next: "npm run post-reports -- list",
    load: (db) =>
      db
        .from("pr_post_reports")
        .select("id,submitted_at,creator_profiles(display_name),restaurants(name)")
        .eq("status", "pending")
        .order("submitted_at")
        .limit(50),
    describe: (row) =>
      `${one(row.creator_profiles)?.display_name ?? "?"} / ${one(row.restaurants)?.name ?? "?"}`,
    at: (row) => row.submitted_at,
  },
  "post-reports-missing": {
    role: "Creatorサポート",
    next: "Creatorに「投稿のインサイト画面のスクショ」をお願いする（アプリの予約詳細から送れる）",
    load: async (db) => {
      const result = await db
        .from("deliverables")
        .select(
          "id,booking_id,submitted_at,pr_post_reports(status),bookings!inner(creator_profiles(display_name),campaigns(restaurants(name)))",
        )
        .not("submitted_url", "is", null)
        .lt("submitted_at", ago(7))
        .not("platform", "in", "(ugc_photo,ugc_video)")
        .order("submitted_at")
        .limit(100);
      if (result.error) return result;
      return {
        data: result.data.filter((row) => {
          const report = one(row.pr_post_reports);
          return !report || report.status === "rejected";
        }),
        error: null,
      };
    },
    describe: (row) => {
      const booking = one(row.bookings);
      return `${one(booking?.creator_profiles)?.display_name ?? "?"} / ${
        one(one(booking?.campaigns)?.restaurants)?.name ?? "?"
      } (booking ${row.booking_id})`;
    },
    at: (row) => row.submitted_at,
  },
  "posts-overdue": {
    role: "Creatorサポート",
    next: "Creatorに投稿期限を連絡。2日以上連絡がなければ店舗に状況を共有",
    load: (db) =>
      db
        .from("deliverables")
        .select("id,booking_id,due_at,bookings!inner(status,creator_profiles(display_name),campaigns(restaurants(name)))")
        .is("submitted_url", null)
        .lt("due_at", new Date().toISOString())
        .in("bookings.status", ["confirmed", "visited"])
        .order("due_at")
        .limit(50),
    describe: (row) => {
      const booking = one(row.bookings);
      return `${one(booking?.creator_profiles)?.display_name ?? "?"} / ${
        one(one(booking?.campaigns)?.restaurants)?.name ?? "?"
      } (booking ${row.booking_id})`;
    },
    at: (row) => row.due_at,
  },
  "applications-waiting": {
    role: "店舗サポート",
    next: "店舗に応募の確認をお願いする（/restaurant/campaigns/<id>/applications）",
    load: (db) =>
      db
        .from("applications")
        .select("id,campaign_id,applied_at,campaigns(title,restaurants(name))")
        .eq("status", "applied")
        .lt("applied_at", ago(2))
        .order("applied_at")
        .limit(50),
    describe: (row) => {
      const campaign = one(row.campaigns);
      return `${one(campaign?.restaurants)?.name ?? "?"} / ${campaign?.title ?? "?"} (campaign ${row.campaign_id})`;
    },
    at: (row) => row.applied_at,
  },
  "campaigns-no-applicants": {
    role: "マッチング",
    next: "おすすめCreatorを招待（/restaurant/campaigns/<id>/applications）。報酬・日程の見直しを店舗に提案",
    load: async (db) => {
      const result = await db
        .from("campaigns")
        .select("id,title,published_at,application_deadline,restaurants(name),applications(id)")
        .in("status", ["published", "recruiting"])
        .eq("visibility", "public")
        .lt("published_at", ago(3))
        .gt("application_deadline", new Date().toISOString())
        .order("published_at")
        .limit(100);
      if (result.error) return result;
      return { data: result.data.filter((row) => !(row.applications ?? []).length), error: null };
    },
    describe: (row) => `${one(row.restaurants)?.name ?? "?"} / ${row.title} (campaign ${row.id})`,
    at: (row) => row.published_at,
  },
  "reviews-low": {
    role: "品質管理",
    next: "双方に事情を聞き、記録したら npm run ops -- followed-up <reviewId>",
    load: (db) =>
      db
        .from("pr_reviews")
        .select("id,booking_id,direction,rating,comment,created_at,creator_profiles(display_name),restaurants(name)")
        .lte("rating", 2)
        .is("followed_up_at", null)
        .order("created_at")
        .limit(50),
    describe: (row) =>
      `★${row.rating} ${row.direction === "restaurant_to_creator" ? "店舗→Creator" : "Creator→店舗"} ${
        one(row.creator_profiles)?.display_name ?? "?"
      } / ${one(row.restaurants)?.name ?? "?"}${row.comment ? `「${row.comment}」` : ""} (review ${row.id})`,
    at: (row) => row.created_at,
  },
  "payments-ready": {
    role: "経理",
    next: "/admin/payments で振込予定・支払済みにする",
    load: (db) =>
      db
        .from("payments")
        .select("id,amount,updated_at,creator_profiles(display_name)")
        .eq("status", "approved")
        .order("updated_at")
        .limit(50),
    describe: (row) =>
      `${one(row.creator_profiles)?.display_name ?? "?"} ¥${Number(row.amount).toLocaleString("ja-JP")}`,
    at: (row) => row.updated_at,
  },
  fees: {
    role: "経理",
    next: "月初に npm run billing -- preview YYYY-MM → 人間が確認 → send YYYY-MM --yes（Stripeで請求書を送付。入金はWebhookで自動反映）。入金期限を過ぎた「請求済み」は店舗に連絡",
    load: (db) =>
      db
        .from("platform_fees")
        .select("id,fee,status,created_at,restaurant_id,restaurants(name)")
        .in("status", ["pending", "invoiced"])
        .order("created_at")
        .limit(500),
    describe: (row) =>
      `${row.status === "invoiced" ? "請求済み・入金待ち" : "請求前"} ${one(row.restaurants)?.name ?? "?"} ¥${Number(row.fee).toLocaleString("ja-JP")} (fee ${row.id})`,
    at: (row) => row.created_at,
  },
};

function age(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / day);
  return days >= 1 ? `${days}日前` : "今日";
}

async function summary() {
  const db = client();
  for (const [name, queue] of Object.entries(queues)) {
    const { data, error } = await queue.load(db);
    if (error) {
      console.log(`${name.padEnd(24)} error: ${error.message}`);
      continue;
    }
    const oldest = data.length ? `（最古 ${age(queue.at(data[0]))}）` : "";
    console.log(`${name.padEnd(24)} ${String(data.length).padStart(3)}件 ${queue.role}${oldest}`);
  }
  console.log("\nnpm run ops -- <queue> で中身を表示します。");
}

async function show(name) {
  const queue = queues[name];
  const { data, error } = await queue.load(client());
  if (error) throw error;
  console.log(`${name} — 担当: ${queue.role}\n次の作業: ${queue.next}\n`);
  if (!data.length) console.log("（なし）");
  for (const row of data) console.log(`- ${age(queue.at(row))}  ${queue.describe(row)}`);
}

async function feeStatus(status, ids) {
  const { data, error } = await client().rpc("set_platform_fee_status", { p_fee_ids: ids, p_status: status });
  if (error) throw error;
  console.log(`${data} fee(s) marked ${status}.`);
}

async function followedUp(reviewId) {
  const { error } = await client().rpc("mark_pr_review_followed_up", { p_review_id: reviewId });
  if (error) throw error;
  console.log("Marked as followed up.");
}

const [command, argument, ...more] = process.argv.slice(2);

try {
  if (!command) await summary();
  else if (command === "followed-up" && argument) await followedUp(argument);
  else if (command === "fee-status" && ["invoiced", "paid"].includes(argument) && more.length) await feeStatus(argument, more);
  else if (queues[command]) await show(command);
  else {
    console.log(`usage: ops-queues.mjs [${Object.keys(queues).join(" | ")}] | followed-up <reviewId> | fee-status invoiced|paid <feeId...>`);
    process.exit(1);
  }
} catch (error) {
  console.error(error.message ?? error);
  process.exit(1);
}
