import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { PerformanceSummaryCard } from "@/components/performance-summary";
import { formatCompactViews } from "@/lib/creator-performance";
import { createClient } from "@/lib/supabase/server";
import { createFlatPlanOrder } from "@/server/actions/order";
import { getPublicMediaKit } from "@/server/queries/performance";

export const dynamic = "force-dynamic";

const validSlug = /^[a-z0-9][a-z0-9-]{2,29}$/;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const kit = validSlug.test(slug) ? await getPublicMediaKit(slug) : null;
  const robots = { index: false, follow: false };

  if (!kit?.flatPlan) return { title: "PRのご依頼｜GOURMET DIARY", robots };

  const title = `${kit.displayName}に一律¥${kit.flatPlan.price.toLocaleString("ja-JP")}でPRを依頼`;
  const description = kit.summary?.highlights.slice(0, 3).join("・") ?? "Instagramリール1本・税込";

  return { title, description, robots, openGraph: { title, description, siteName: "GOURMET DIARY" } };
}

function nowInTokyoInput(offsetDays: number) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return `${parts}T00:00`;
}

export default async function FlatPlanOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { slug } = await params;
  const { message } = await searchParams;
  if (!validSlug.test(slug)) notFound();

  const kit = await getPublicMediaKit(slug);
  if (!kit) notFound();

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const { data: viewer } = authData.user
    ? await supabase
        .from("users")
        .select("role,onboarding_completed_at")
        .eq("id", authData.user.id)
        .maybeSingle()
    : { data: null };

  const isRestaurant = viewer?.role === "restaurant" && Boolean(viewer.onboarding_completed_at);
  const next = `/order/${slug}`;
  const summary = kit.summary;

  return (
    <main className="creator-shell order-page">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">PR ORDER</span>
      </header>

      <section className="order-hero">
        <span className="eyebrow">{kit.displayName}のPR</span>
        {kit.flatPlan ? (
          <>
            <h1>
              一律<strong>¥{kit.flatPlan.price.toLocaleString("ja-JP")}</strong>
              <small>税込</small>
            </h1>
            <ul>
              <li>Instagramリール1本を投稿</li>
              <li>お食事は1名分のみご提供ください</li>
              <li>追加料金・価格交渉なし</li>
            </ul>
          </>
        ) : (
          <h1>現在、定額プランの受付を停止しています</h1>
        )}
        {summary ? (
          <p className="order-proof">
            直近30日 {summary.postCount}投稿・合計{summary.viewsApprox ? "約" : ""}
            {formatCompactViews(summary.totalViews)}閲覧・1投稿あたり中央値
            {formatCompactViews(summary.medianViews)}
            {summary.verified === "all" ? "（運営確認済み）" : ""}
          </p>
        ) : null}
      </section>

      {message ? <div className="form-message">{message}</div> : null}

      {kit.flatPlan ? (
        isRestaurant ? (
          <form action={createFlatPlanOrder} className="campaign-form order-form">
            <input name="slug" type="hidden" value={slug} />
            <section className="form-section">
              <span className="eyebrow">ご依頼</span>
              <h2>来店できる日時を1〜3つ</h2>
              <p className="field-help">
                {kit.displayName}がこの中から行ける日時を選びます。確定すると通知が届きます。
              </p>
              <label>
                候補1
                <input min={nowInTokyoInput(0)} name="candidate1" required type="datetime-local" />
              </label>
              <label>
                候補2（任意）
                <input min={nowInTokyoInput(0)} name="candidate2" type="datetime-local" />
              </label>
              <label>
                候補3（任意）
                <input min={nowInTokyoInput(0)} name="candidate3" type="datetime-local" />
              </label>
              <label>
                紹介してほしいこと（任意）
                <textarea
                  maxLength={500}
                  name="note"
                  placeholder="おすすめメニュー・撮影してほしいポイントなど"
                  rows={3}
                />
              </label>
            </section>
            <PendingSubmitButton
              idleLabel={`¥${kit.flatPlan.price.toLocaleString("ja-JP")}（税込）で依頼する`}
              pendingLabel="送信中..."
            />
          </form>
        ) : (
          <section className="media-kit-contact">
            <strong>ご依頼には店舗アカウントが必要です（無料）</strong>
            <p>
              登録後、このページに戻って候補日時を入力するだけで依頼できます。日程調整・投稿確認・お支払い状況の確認まで、DMなしで進みます。
            </p>
            <Link className="primary-button" href={`/signup?next=${encodeURIComponent(next)}`}>
              店舗登録して依頼する
            </Link>
            <Link className="secondary-button order-login" href={`/login?next=${encodeURIComponent(next)}`}>
              登録済みの方はログイン
            </Link>
          </section>
        )
      ) : null}

      {summary ? <PerformanceSummaryCard postLimit={5} summary={summary} /> : null}
    </main>
  );
}
