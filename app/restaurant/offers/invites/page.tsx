import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { restaurantInviteTemplate } from "@/lib/dm-templates";
import { getSiteOrigin } from "@/lib/site-origin";
import { getRestaurantInvites } from "@/server/queries/invites";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
});

export default async function RestaurantInvitesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;
  const [invites, origin] = await Promise.all([getRestaurantInvites(), getSiteOrigin()]);

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">Restaurant</span>
      </header>

      <Link className="back-link" href="/restaurant">
        ← ホーム
      </Link>

      <span className="eyebrow">INVITE</span>
      <h1 className="page-title">Instagramで招待</h1>
      <p className="page-subtitle">
        DMでPRをお願いしている人にも、ここで作った招待リンクを送れば、日程・投稿確認・効果測定までアプリで進められます。
      </p>

      <Link className="primary-button" href="/restaurant/offers/new">
        ＋ 招待リンクをつくる
      </Link>

      {invites.length ? (
        <section className="dashboard-section">
          {invites.map((invite) => {
            const url = `${origin}/i/${invite.token}`;
            const message = restaurantInviteTemplate({
              restaurantName: invite.restaurantName,
              handle: invite.handle,
              cashReward: invite.cashReward,
              url,
            });

            return (
              <article
                className={invite.token === created ? "invite-card is-new" : "invite-card"}
                key={invite.token}
              >
                <div className="deliverable-head">
                  <strong>@{invite.handle}</strong>
                  <span className={invite.claimedBy ? "status-chip status-approved" : "status-chip"}>
                    {invite.claimedBy ? `${invite.claimedBy}さんが登録済み` : "登録待ち"}
                  </span>
                </div>
                {invite.token === created ? (
                  <div className="form-message inline-success">
                    招待リンクを作成しました。下の文面をコピーして、InstagramのDMで送ってください。
                  </div>
                ) : null}
                {invite.claimedBy ? (
                  <Link className="submitted-link" href={`/restaurant/campaigns/${invite.campaignId}/applications`}>
                    応募・日程を確認 →
                  </Link>
                ) : (
                  <>
                    <pre className="dm-template">{message}</pre>
                    <div className="signal-link-row">
                      <CopyButton label="DM文面をコピー" value={message} />
                      <CopyButton label="リンクだけ" value={url} />
                    </div>
                  </>
                )}
                <p className="field-help">{dateFormatter.format(new Date(invite.createdAt))}作成</p>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="section-card">
          <strong>まだ招待はありません</strong>
          <p>指名オファーの画面で「まだ登録していない人を招待」を選ぶと作れます。</p>
        </section>
      )}
    </main>
  );
}
