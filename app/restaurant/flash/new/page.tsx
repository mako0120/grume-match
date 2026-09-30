import Link from "next/link";
import { createFlashCampaign } from "@/server/actions/flash";

export default async function NewFlashPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

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
        <h1>今日・明日の空席をPR枠へ。</h1>
        <p>
          来店時間を1枠だけ設定して、今行けるCreatorを有償で募集します。
        </p>
      </section>

      {message ? <div className="form-message">{message}</div> : null}

      <form action={createFlashCampaign} className="campaign-form">
        <section className="form-section">
          <span className="eyebrow">01 OFFER</span>
          <h2>FLASH内容</h2>

          <label>
            タイトル
            <input
              name="title"
              placeholder="本日19:30 焼肉コースPR"
              required
            />
          </label>

          <div className="field-row">
            <label>
              ジャンル
              <input name="category" placeholder="焼肉" required />
            </label>
            <label>
              エリア
              <input name="area" placeholder="難波" required />
            </label>
          </div>

          <label>
            PRしてほしい内容
            <textarea name="description" rows={3} />
          </label>
        </section>

        <section className="form-section">
          <span className="eyebrow">02 REWARD</span>
          <h2>現金報酬</h2>

          <div className="field-row">
            <label>
              報酬（税込）
              <input
                defaultValue="7000"
                min="0"
                name="cashReward"
                required
                type="number"
              />
            </label>
            <label>
              募集人数
              <input
                defaultValue="1"
                min="1"
                name="creatorSlots"
                required
                type="number"
              />
            </label>
          </div>

          <label>
            食事提供
            <input defaultValue="2名まで食事提供" name="foodOffer" />
          </label>

          <label>
            同伴者上限
            <input defaultValue="1" min="0" name="maxCompanions" type="number" />
          </label>
        </section>

        <section className="form-section">
          <span className="eyebrow">03 TIME</span>
          <h2>来店時間</h2>

          <label>
            来店日時
            <input name="startsAt" required type="datetime-local" />
          </label>

          <label>
            応募締切
            <input name="deadline" required type="datetime-local" />
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

        <section className="form-section">
          <span className="eyebrow">04 POST</span>
          <h2>必須投稿</h2>

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

        <button className="primary-button publish-button flash-publish" type="submit">
          FLASH募集を開始
        </button>
      </form>
    </main>
  );
}
