import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PerformanceSummaryCard } from "@/components/performance-summary";
import { rowToPostMetric, summarizePerformance } from "@/lib/creator-performance";
import { withNext } from "@/lib/next-path";
import { formatRating } from "@/lib/pr-feedback";
import { formatFeeRule } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PRのご依頼",
  robots: { index: false, follow: false },
};

function todayInTokyo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
}

type PageRow = {
  creator_id: string;
  display_name: string;
  base_area: string;
  bio: string | null;
  min_reward: number;
  completed_prs: number;
  review_count: number;
  average_rating: number | string | null;
  posts: Parameters<typeof rowToPostMetric>[0][];
};

// A Creator's PR request page, sent in reply to DM requests. Restaurants
// see verified numbers only and send a Direct OFFER from here.
export default async function CreatorRequestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!/^[a-z0-9_-]{3,30}$/i.test(slug)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_creator_request_page", { p_slug: slug }).maybeSingle();
  const page = data as PageRow | null;
  if (!page) notFound();

  const summary = summarizePerformance((page.posts ?? []).map(rowToPostMetric), {
    today: todayInTokyo(),
  });
  const rating = formatRating(
    page.review_count
      ? { reviewCount: page.review_count, averageRating: Number(page.average_rating), topTags: [] }
      : null,
  );

  const { data: authData } = await supabase.auth.getUser();
  const { data: userRow } = authData.user
    ? await supabase.from("users").select("role,onboarding_completed_at").eq("id", authData.user.id).maybeSingle()
    : { data: null };
  const offerPath = `/restaurant/offers/new?creator=${page.creator_id}`;
  const cta =
    userRow?.role === "restaurant" && userRow.onboarding_completed_at
      ? offerPath
      : withNext("/signup", offerPath, "restaurant");

  return (
    <main className="creator-shell signal-landing">
      <span className="eyebrow">PR REQUEST</span>

      <section className="booking-hero">
        <span className="eyebrow">{page.base_area}・グルメCreator</span>
        <h1>{page.display_name}</h1>
        {page.bio ? <p>{page.bio}</p> : null}
        <div className="booking-visit">
          {page.min_reward > 0
            ? `お食事＋報酬 ¥${page.min_reward.toLocaleString("ja-JP")}〜`
            : "お食事のご招待から受け付けています"}
        </div>
      </section>

      <section className="summary-grid">
        <div className="summary-item">
          <span>このアプリでのPR</span>
          <strong>{page.completed_prs}件完了</strong>
        </div>
        <div className="summary-item">
          <span>店舗からの評価</span>
          <strong>{rating}</strong>
        </div>
      </section>

      {summary ? (
        <PerformanceSummaryCard postLimit={6} summary={summary} />
      ) : (
        <section className="section-card">
          <strong>実績は確認中です</strong>
          <p>運営が確認した投稿の数字だけを表示します。</p>
        </section>
      )}

      <section className="section-card request-cta">
        <strong>このCreatorにPRを依頼する</strong>
        <p>
          条件と候補日時を送るだけ。Creatorは行ける時間をタップして応募します。DMでの日程調整はいりません。
        </p>
        <p className="field-help">
          初期費用・月額0円。手数料は{formatFeeRule()}。最初の1件は無料です。
        </p>
        <Link className="primary-button" href={cta}>
          依頼する（店舗の無料登録）
        </Link>
      </section>
    </main>
  );
}
