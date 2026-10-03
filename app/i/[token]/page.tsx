import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { withNext } from "@/lib/next-path";
import { formatReward } from "@/lib/pricing";
import { platformLabels } from "@/lib/status-labels";
import { createClient } from "@/lib/supabase/server";
import { claimInvite } from "@/server/actions/invites";
import { getInvitePreview } from "@/server/queries/invites";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PRのご依頼",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function shortDate(value: string) {
  const [, month, day] = value.slice(0, 10).split("-");
  return `${Number(month)}/${Number(day)}`;
}

export default async function OfferInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { token: rawToken } = await params;
  const { message } = await searchParams;
  const token = rawToken.toLowerCase();
  if (!/^[a-z0-9]{20}$/.test(token)) notFound();

  const invite = await getInvitePreview(token);
  if (!invite) notFound();

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const { data: userRow } = authData.user
    ? await supabase.from("users").select("role,onboarding_completed_at").eq("id", authData.user.id).maybeSingle()
    : { data: null };
  const isCreator = userRow?.role === "creator" && Boolean(userRow.onboarding_completed_at);
  const path = `/i/${token}`;

  return (
    <main className="creator-shell signal-landing">
      <span className="eyebrow">PR REQUEST</span>
      <p className="signal-disclosure">@{invite.handle} さんへのPR投稿のご依頼です。</p>

      <section className="booking-hero">
        <span className="eyebrow">{invite.area}</span>
        <h1>{invite.restaurantName}</h1>
        <p>{invite.title}</p>
        <div className="booking-visit">
          {formatReward(invite.cashReward)}
          {invite.cashReward > 0 ? "＋お食事" : "（現金報酬なし）"}
        </div>
      </section>

      {message ? <div className="form-message error-message">{message}</div> : null}

      <section className="summary-grid">
        <div className="summary-item">
          <span>お食事</span>
          <strong>{invite.foodOffer}</strong>
        </div>
        <div className="summary-item">
          <span>来店人数</span>
          <strong>{invite.maxCompanions === 0 ? "1名" : `1〜${invite.maxCompanions + 1}名`}</strong>
        </div>
        <div className="summary-item">
          <span>来店期間</span>
          <strong>
            {shortDate(invite.visitPeriodStart)}〜{shortDate(invite.visitPeriodEnd)}
          </strong>
        </div>
        <div className="summary-item">
          <span>投稿</span>
          <strong>{invite.platforms.map((item) => platformLabels[item] ?? item).join("・")}</strong>
        </div>
      </section>

      {invite.description ? (
        <section className="section-card">
          <strong>お店から</strong>
          <p>{invite.description}</p>
        </section>
      ) : null}

      <section className="section-card">
        {invite.claimedByMe && invite.campaignId ? (
          <>
            <strong>受け付け済みです</strong>
            <p>候補日時から行ける時間をタップして応募してください。</p>
            <Link className="primary-button" href={`/creator/campaigns/${invite.campaignId}`}>
              日時を選ぶ →
            </Link>
          </>
        ) : invite.claimed ? (
          <>
            <strong>この依頼は受け付け済みです</strong>
            <p>別のアカウントで受け付けられています。</p>
          </>
        ) : !invite.open ? (
          <>
            <strong>受付は終了しました</strong>
            <p>お店に直接ご確認ください。</p>
          </>
        ) : isCreator ? (
          <form action={claimInvite}>
            <input name="token" type="hidden" value={token} />
            <strong>この依頼を受けますか？</strong>
            <p>受けると、候補日時をタップして応募できます。条件はこのページのとおりです。</p>
            <button className="primary-button form-submit" type="submit">
              この依頼を受ける
            </button>
          </form>
        ) : authData.user && userRow?.onboarding_completed_at ? (
          <>
            <strong>Creatorアカウントで開いてください</strong>
            <p>店舗のアカウントでは依頼を受けられません。</p>
          </>
        ) : (
          <>
            <strong>無料登録して依頼を受ける</strong>
            <p>メールアドレスで登録し、Creatorとして始めるとこの依頼を受けられます。Creatorに手数料はかかりません。</p>
            <Link className="primary-button" href={withNext("/signup", path, "creator")}>
              登録して受ける
            </Link>
            <Link className="secondary-button" href={withNext("/login", path, "creator")}>
              登録済みの方はログイン
            </Link>
          </>
        )}
      </section>

      <section className="signal-privacy">
        <strong>PR表記について</strong>
        <p>
          お食事のご招待だけでも広告にあたります。投稿には「PR」などの表記をお願いします。
        </p>
      </section>
    </main>
  );
}
