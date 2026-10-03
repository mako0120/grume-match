import { FeeNote } from "@/components/fee-note";
import Link from "next/link";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { createFlashCampaign } from "@/server/actions/flash";
import { listActiveStandbyCreators } from "@/server/queries/standby";

export default async function NewFlashPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const standbyCreators = await listActiveStandbyCreators();

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill flash-status">FLASH</span>
      </header>

      <Link className="back-link" href="/restaurant">
        ← 店舗管理
      </Link>

      <section className="flash-hero">
        <span className="eyebrow">URGENT PR</span>
        <h1>空席を、今行けるCreatorへ。</h1>
        <p>
          来店時間と報酬を決めて公開するだけ。回答締切は自動で設定されます。
        </p>
      </section>

      <section className="standby-restaurant-card">
        <div>
          <span className="eyebrow">NOW AVAILABLE</span>
          <strong>{standbyCreators.length}人</strong>
          <p>現在「今行ける」をONにしているCreator</p>
        </div>

        {standbyCreators.length ? (
          <div className="standby-creator-list">
            {standbyCreators.slice(0, 4).map((creator) => (
              <div className="standby-creator-row" key={creator.creator_id}>
                <div>
                  <strong>{creator.display_name}</strong>
                  <span>
                    Instagram {Number(creator.followers).toLocaleString()}
                  </span>
                </div>
                <span className="meta-pill">{creator.base_area}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="standby-empty">
            今は待機中Creatorはいません。FLASHは通常どおり公開できます。
          </p>
        )}
      </section>

      {message ? <div className="form-message">{message}</div> : null}

      <form action={createFlashCampaign} className="campaign-form">
        <section className="form-section">
          <span className="eyebrow">01 CONDITIONS</span>
          <h2>条件</h2>

          <div className="field-row">
            <label>
              ジャンル
              <input name="category" placeholder="焼肉" required />
            </label>
            <label>
              現金報酬（税込）
              <input
                defaultValue="7000"
                min="1"
                name="cashReward"
                required
                type="number"
              />
            </label>
          </div>
          <FeeNote />

          <label>
            食事提供
            <input defaultValue="1名分提供" name="foodOffer" />
          </label>

          <div className="field-row">
            <label>
              来店人数
              <select defaultValue="0" name="maxCompanions">
                <option value="0">1名</option>
                <option value="1">1〜2名</option>
                <option value="2">1〜3名</option>
              </select>
            </label>
            <label>
              募集Creator数
              <input defaultValue="1" min="1" name="creatorSlots" type="number" />
            </label>
          </div>

          <label>
            メモ（任意）
            <textarea
              name="description"
              placeholder="紹介してほしい料理など。空欄でもOKです。"
              rows={3}
            />
          </label>
        </section>

        <section className="form-section">
          <span className="eyebrow">02 TIME</span>
          <h2>来店時間</h2>

          <label>
            来店日時
            <input name="startsAt" required type="datetime-local" />
          </label>

          <p className="field-help">
            応募締切は来店30分前に自動設定されます。来店日時は現在から1時間以上先を選択してください。
          </p>

          <label>
            滞在時間
            <select defaultValue="120" name="durationMinutes">
              <option value="90">90分</option>
              <option value="120">120分</option>
              <option value="150">150分</option>
            </select>
          </label>
        </section>

        <section className="form-section">
          <span className="eyebrow">03 POST</span>
          <h2>投稿先</h2>

          <div className="check-grid">
            <label>
              <input
                defaultChecked
                name="platforms"
                type="checkbox"
                value="instagram_reel"
              />
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
          </div>
        </section>

        <PendingSubmitButton
          className="primary-button publish-button flash-publish"
          idleLabel="FLASHを公開"
          pendingLabel="公開中..."
        />
      </form>
    </main>
  );
}
