import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/server/actions/notifications";
import { notificationTypeLabels } from "@/lib/status-labels";
import { listNotifications } from "@/server/queries/notifications";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/login");

  const notifications = await listNotifications();
  const unread = notifications.filter((item) => !item.read_at).length;

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">未読 {unread}件</span>
      </header>

      <div className="section-heading">
        <div>
          <h1 className="page-title">通知</h1>
          <p className="page-subtitle">
            採用・日時変更・投稿確認・報酬の進捗をまとめて確認します。
          </p>
        </div>

        {unread ? (
          <form action={markAllNotificationsRead}>
            <button className="secondary-button" type="submit">
              すべて既読
            </button>
          </form>
        ) : null}
      </div>

      {notifications.length ? (
        <section className="notification-list">
          {notifications.map((item) => (
            <article
              className={item.read_at ? "notification-card" : "notification-card unread"}
              key={item.id}
            >
              <div>
                <span className="meta-pill">
                  {notificationTypeLabels[item.type] ?? "お知らせ"}
                </span>
                <h2>{item.title}</h2>
                <p>{item.body}</p>
                <small>{dateFormatter.format(new Date(item.created_at))}</small>
              </div>

              {!item.read_at ? (
                <form action={markNotificationRead}>
                  <input name="id" type="hidden" value={item.id} />
                  <button className="secondary-button" type="submit">
                    既読
                  </button>
                </form>
              ) : null}
            </article>
          ))}
        </section>
      ) : (
        <section className="section-card">
          <strong>通知はありません</strong>
          <p>案件に動きがあるとここに届きます。</p>
        </section>
      )}
    </main>
  );
}
