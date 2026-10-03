import { formatReward } from "@/lib/pricing";
import { withdrawCampaignApplication } from "@/server/actions/applications";
import { listCreatorApplications } from "@/server/queries/creator-applications";

const statusLabels: Record<string, string> = {
  applied: "応募済み",
  shortlisted: "選考中",
  accepted: "採用",
  rejected: "見送り",
  withdrawn: "辞退",
  scheduled: "日時確定",
  visited: "来店済み",
  submitted: "投稿確認中",
  approved: "承認済み",
  paid: "支払済み",
  reschedule_requested: "日時変更中",
  cancelled: "キャンセル",
  dispute: "確認中",
};

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function CreatorApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; status?: string }>;
}) {
  const { message, status } = await searchParams;
  const applications = await listCreatorApplications();

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">Creator</span>
      </header>

      <h1 className="page-title">応募履歴</h1>
      <p className="page-subtitle">
        応募後の状態を、DMではなくアプリ上で確認できます。
      </p>

      {message ? (
        <div
          className={status === "error" ? "form-message error-message" : "form-message inline-success"}
          aria-live="polite"
        >
          {message}
        </div>
      ) : null}

      {applications.length ? (
        <section className="campaign-list">
          {applications.map((application) => {
            const campaign = relationOne(application.campaigns);
            const restaurant = relationOne(campaign?.restaurants);

            return (
              <article className="booking-card" key={application.id}>
                <div>
                  <span className="meta-pill">
                    {statusLabels[application.status] ?? application.status}
                  </span>
                  <h2>{restaurant?.name ?? "店舗"}</h2>
                  <p>{campaign?.title ?? "PR案件"}</p>
                </div>
                <div className="application-side">
                  <div className="booking-money">
                    {formatReward(Number(campaign?.cash_reward ?? 0))}
                    <small>{campaign?.area ?? ""}</small>
                  </div>

                  {["applied", "shortlisted", "accepted"].includes(application.status) ? (
                    <form action={withdrawCampaignApplication}>
                      <input
                        name="applicationId"
                        type="hidden"
                        value={application.id}
                      />
                      <button className="text-button" type="submit">
                        応募を取り消す
                      </button>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="section-card">
          <strong>まだ応募はありません</strong>
          <p>気になる案件の来店日時を選ぶと、ここに応募状況が表示されます。</p>
        </section>
      )}
    </main>
  );
}
