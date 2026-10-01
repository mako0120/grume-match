import { PendingSubmitButton } from "@/components/pending-submit-button";
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
        必要な項目だけ入力して公開。タイトル・エリア・応募締切などは自動で設定します。
      </p>

      {message ? <div className="form-message">{message}</div> : null}

      <form action={createCampaign} className="campaign-form">
        <section className="form-section">
          <span className="eyebrow">01 CONTENT</span>
          <h2>何をPRしてほしい？</h2>

          <label>
            ジャンル
            <input name="category" placeholder="焼肉" required />
          </label>

          <label>
            メモ（任意）
            <textarea
              name="description"
              placeholder="紹介してほしい料理やポイント。空欄でもOKです。"
              rows={3}
            />
          </label>
        </section>

        <section className="form-section">
          <span className="eyebrow">02 CONDITIONS</span>
          <h2>条件</h2>

          <div className="field-row">
            <label>
              現金報酬（税込）
              <input
                defaultValue="6000"
                min="1"
                name="cashReward"
                required
                type="number"
              />
            </label>

            <label>
              募集Creator数
              <input
                defaultValue="3"
                min="1"
                name="creatorSlots"
                required
                type="number"
              />
            </label>
          </div>

          <label>
            食事提供
            <input defaultValue="1名分提供" name="foodOffer" />
          </label>

          <label>
            来店人数
            <select defaultValue="0" name="maxCompanions">
              <option value="0">1名</option>
              <option value="1">1〜2名</option>
              <option value="2">1〜3名</option>
            </select>
          </label>

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
              <input name="platforms" type="checkbox" value="instagram_feed" />
              Instagram Feed
            </label>
            <label>
              <input name="platforms" type="checkbox" value="instagram_story" />
              Story
            </label>
            <label>
              <input name="platforms" type="checkbox" value="tiktok" />
              TikTok
            </label>
          </div>
        </section>

        <section className="form-section">
          <span className="eyebrow">03 DATE</span>
          <h2>来店できる日</h2>

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

          <p className="field-help">
            来店候補は30分刻み・滞在2時間・1枠1組で自動生成します。応募締切も自動です。
          </p>
        </section>

        <PendingSubmitButton
          idleLabel="この内容で公開"
          pendingLabel="公開中..."
        />
      </form>
    </main>
  );
}
