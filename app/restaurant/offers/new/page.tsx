import Link from "next/link";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { UsageRightsFields } from "@/components/usage-rights-fields";
import { createDirectOffer } from "@/server/actions/offers";
import { MatchReasons } from "@/components/match-reasons";
import { PerformanceChip } from "@/components/performance-summary";
import { rankCreators } from "@/lib/matching";
import { createClient } from "@/lib/supabase/server";
import { listCreatorsForDirectOffer } from "@/server/queries/creators";
import { loadMatchCreators } from "@/server/queries/matching";

export default async function NewDirectOfferPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; q?: string; creator?: string }>;
}) {
  const { message, q = "", creator: preselected = "" } = await searchParams;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const [listed, membership] = await Promise.all([
    listCreatorsForDirectOffer(q, preselected),
    supabase
      .from("restaurant_memberships")
      .select("restaurants(area)")
      .eq("user_id", authData.user?.id ?? "")
      .limit(1)
      .maybeSingle(),
  ]);
  const restaurant = membership.data?.restaurants as { area: string } | { area: string }[] | null | undefined;
  const restaurantArea = (Array.isArray(restaurant) ? restaurant[0]?.area : restaurant?.area) ?? "";

  // Best fit for this restaurant's area first (the reward is not decided yet).
  const matchCreators = await loadMatchCreators(
    listed.map((creator) => ({
      id: creator.id,
      display_name: creator.displayName,
      base_area: creator.baseArea,
      min_reward: creator.minReward,
      bio: creator.bio,
    })),
  );
  const ranked = rankCreators({ area: restaurantArea, category: "", cashReward: null }, matchCreators);
  const byId = new Map(listed.map((creator) => [creator.id, creator]));
  const creators = ranked
    .map(({ creator, match }) => ({ ...byId.get(creator.id)!, match, performance: creator.performance }))
    .sort((a, b) => Number(b.id === preselected) - Number(a.id === preselected));

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">DIRECT OFFER</span>
      </header>

      <Link className="back-link" href="/restaurant">
        ← 店舗管理
      </Link>

      <section className="direct-offer-hero">
        <span className="eyebrow">SIMPLE OFFER</span>
        <h1>1人選ぶ。条件を出す。送る。</h1>
        <p>
          価格交渉はありません。Creatorは提示条件で参加する場合だけ、
          候補日時をタップして応募します。
        </p>
      </section>

      {message ? <div className="form-message">{message}</div> : null}

      <form className="creator-search" method="get">
        <input
          defaultValue={q}
          name="q"
          placeholder="Creator名・エリア・Instagramで検索"
        />
        <button className="secondary-button" type="submit">
          検索
        </button>
      </form>

      <form action={createDirectOffer} className="campaign-form">
        <section className="form-section">
          <span className="eyebrow">01 CREATOR</span>
          <h2>依頼する人</h2>

          {creators.length ? (
            <div className="creator-picker">
              {creators.map((creator) => (
                <label className="creator-option" key={creator.id}>
                  <input
                    defaultChecked={creator.id === preselected}
                    name="creatorId"
                    required
                    type="radio"
                    value={creator.id}
                  />
                  <div>
                    <strong>{creator.displayName}</strong>
                    <span>{creator.baseArea}</span>
                    <p>
                      Instagram {creator.followers.toLocaleString()} followers
                      {creator.minReward > 0
                        ? " ・ 目安 ¥" + creator.minReward.toLocaleString() + "〜"
                        : ""}
                    </p>
                    <MatchReasons compact match={creator.match} />
                    <PerformanceChip summary={creator.performance} />
                    <Link className="creator-option-link" href={`/restaurant/creators/${creator.id}`}>
                      実績を見る →
                    </Link>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="form-message">
              {q
                ? "条件に合うCreatorが見つかりませんでした。"
                : "指名できるCreatorがまだ登録されていません。"}
            </div>
          )}
        </section>

        <section className="form-section">
          <span className="eyebrow">02 CONDITIONS</span>
          <h2>条件</h2>

          <div className="field-row">
            <label>
              現金報酬（税込）
              <input defaultValue="6000" min="1" name="cashReward" required type="number" />
            </label>
            <label>
              来店人数
              <select defaultValue="0" name="maxCompanions">
                <option value="0">1名</option>
                <option value="1">1〜2名</option>
                <option value="2">1〜3名</option>
              </select>
            </label>
          </div>

          <label>
            食事提供
            <input defaultValue="1名分提供" name="foodOffer" />
          </label>

          <div className="check-grid">
            <label>
              <input defaultChecked name="platforms" type="checkbox" value="instagram_reel" />
              Instagram Reel
            </label>
            <label>
              <input name="platforms" type="checkbox" value="tiktok" />
              TikTok
            </label>
            <label>
              <input name="platforms" type="checkbox" value="instagram_story" />
              Story
            </label>
            <label>
              <input name="platforms" type="checkbox" value="ugc_photo" />
              UGC写真（納品）
            </label>
            <label>
              <input name="platforms" type="checkbox" value="ugc_video" />
              UGC縦動画（納品）
            </label>
          </div>

          <label>
            メモ（任意）
            <textarea
              name="note"
              placeholder="紹介してほしい料理など。空欄でもOKです。"
              rows={3}
            />
          </label>
        </section>

        <UsageRightsFields />

        <section className="form-section">
          <span className="eyebrow">03 DATE</span>
          <h2>候補日時を1〜3つ</h2>
          <p className="field-help">
            Creatorはこの中から行ける時間をタップするだけです。
          </p>

          <label>
            候補1
            <input name="candidate1" required type="datetime-local" />
          </label>
          <label>
            候補2（任意）
            <input name="candidate2" type="datetime-local" />
          </label>
          <label>
            候補3（任意）
            <input name="candidate3" type="datetime-local" />
          </label>

          <label>
            滞在時間
            <select defaultValue="120" name="durationMinutes">
              <option value="90">90分</option>
              <option value="120">120分</option>
              <option value="150">150分</option>
            </select>
          </label>
        </section>

        <section className="fixed-offer-note">
          <strong>固定条件・交渉なし</strong>
          <p>
            Creatorは「この条件で参加する」か「見送る」だけ。
            参加する場合は候補日時を選ぶだけです。
          </p>
        </section>

        <PendingSubmitButton
          disabled={!creators.length}
          idleLabel="この条件で送る"
          pendingLabel="送信中..."
        />
      </form>
    </main>
  );
}
