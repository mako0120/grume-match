import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { saveRestaurantProfile } from "@/server/actions/restaurant-profile";

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function RestaurantSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; status?: string }>;
}) {
  const { message, status } = await searchParams;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("restaurant_memberships")
    .select("restaurant_id,restaurants(name,address,area)")
    .eq("user_id", authData.user!.id)
    .order("id")
    .limit(1)
    .maybeSingle();

  const restaurant = one(membership?.restaurants);

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <Link className="header-action" href="/restaurant">
          ホームへ戻る
        </Link>
      </header>

      <span className="eyebrow">RESTAURANT SETTINGS</span>
      <h1 className="page-title">店舗情報</h1>
      <p className="page-subtitle">
        案件作成時に使う基本情報をここで更新できます。
      </p>

      {message ? (
        <div
          aria-live="polite"
          className={status === "error" ? "form-message error-message" : "form-message inline-success"}
        >
          {message}
        </div>
      ) : null}

      <form action={saveRestaurantProfile} className="campaign-form">
        <section className="form-section">
          <label>
            店舗名
            <input
              defaultValue={restaurant?.name ?? ""}
              name="name"
              required
            />
          </label>

          <label>
            エリア
            <input
              defaultValue={restaurant?.area ?? ""}
              name="area"
              placeholder="梅田 / 難波 / 心斎橋"
              required
            />
          </label>

          <label>
            住所
            <input
              defaultValue={restaurant?.address ?? ""}
              name="address"
              required
            />
          </label>

          <button className="primary-button publish-button" type="submit">
            店舗情報を保存
          </button>
        </section>
      </form>
    </main>
  );
}
