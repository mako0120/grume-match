import { createCampaign } from "@/server/actions/campaigns";

const weekdays = [
  ["0", "日"],
  ["1", "月"],
  ["2", "火"],
  ["3", "水"],
  ["4", "木"],
  ["5", "金"],
  ["6", "土"],
] as const;

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  return (
    <main className="creator-shell">
      <header className="creator-header">
        <strong>GOURMET DIARY</strong>
        <span className="status-pill">Restaurant</span>
      </header>

      <h1 className="page-title">PR案件を作成</h1>
      <p className="page-subtitle">
        現金報酬と来店可能時間を最初に設定。公開後はCreatorが空き時間をタップして応募します。
      </p>

      {message ? <div className="form-message">{message}</div> : null}

      <form action={createCampaign} className="campaign-form">
        <section className="form-section">
          <span className="eyebrow">01 CAMPAIGN</span>
          <h2>PR内容</h2>
          <label>
            タイトル
            <input name="title" placeholder="黒毛和牛コース リールPR募集" required />
          </label>
          <div className="field-row">
            <label>
              ジャンル
              <input name="category" placeholder="焼肉" required />
            </label>
            <label>
              エリア
              <input name="area" placeholder="心斎橋" required />
            </label>
          </div>
          <label>
            紹介してほしい内容
            <textarea name="description" rows={4} placeholder="新コースの特徴、推してほしい料理など" />
          </label>
        </section>

        <section className="form-section">
          <span className="eyebrow">02 REWARD</span>
          <h2>報酬と提供内容</h2>
          <div className="field-row">
            <label>
              現金報酬（税込）
              <input defaultValue="6000" min="0" name="cashReward" required type="number" />
            </label>
            <label>
              募集Creator数
              <input defaultValue="3" min="1" name="creatorSlots" required type="number" />
            </label>
          </div>
          <label>
            食事提供
            <input defaultValue="2名までコース提供" name="foodOffer" />
          </label>
          <label>
            同伴者上限
            <input defaultValue="1" min="0" name="maxCompanions" type="number" />
          </label>
        </section>

        <section className="form-section">
          <span className="eyebrow">03 DELIVERABLE</span>
          <h2>必須投稿</h2>
          <div className="check-grid">
            <label><input defaultChecked name="platforms" type="checkbox" value="instagram_reel" /> Instagram Reel</label>
            <label><input name="platforms" type="checkbox" value="instagram_feed" /> Instagram Feed</label>
            <label><input name="platforms" type="checkbox" value="instagram_story" /> Story</label>
            <label><input name="platforms" type="checkbox" value="tiktok" /> TikTok</label>
            <label><input name="platforms" type="checkbox" value="youtube_shorts" /> YouTube Shorts</label>
          </div>
        </section>

        <section className="form-section">
          <span className="eyebrow">04 TAP SCHEDULE</span>
          <h2>来店可能枠</h2>
          <div className="field-row">
            <label>
              開始日
              <input name="visitStart" required type="date" />
            </label>
            <label>
              終了日
              <input name="visitEnd" required type="date" />
            </label>
          </div>

          <span className="field-caption">受付する曜日</span>
          <div className="weekday-grid">
            {weekdays.map(([value, label]) => (
              <label key={value}>
                <input
                  defaultChecked={["1", "2", "3", "4"].includes(value)}
                  name="weekdays"
                  type="checkbox"
                  value={value}
                />
                {label}
              </label>
            ))}
          </div>

          <div className="field-row">
            <label>
              受付開始
              <input defaultValue="17:00" name="startTime" required type="time" />
            </label>
            <label>
              受付終了
              <input defaultValue="21:00" name="endTime" required type="time" />
            </label>
          </div>

          <div className="field-row three">
            <label>
              枠間隔
              <select defaultValue="30" name="intervalMinutes">
                <option value="30">30分</option>
                <option value="60">60分</option>
              </select>
            </label>
            <label>
              滞在時間
              <select defaultValue="120" name="visitDurationMinutes">
                <option value="90">90分</option>
                <option value="120">120分</option>
                <option value="150">150分</option>
              </select>
            </label>
            <label>
              各枠の受入組数
              <input defaultValue="1" min="1" name="slotCapacity" type="number" />
            </label>
          </div>

          <label>
            応募締切
            <input name="applicationDeadline" required type="datetime-local" />
          </label>
        </section>

        <button className="primary-button publish-button" type="submit">
          この内容で案件を公開
        </button>
      </form>
    </main>
  );
}
