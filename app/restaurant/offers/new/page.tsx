import Link from "next/link";
import { createDirectOffer } from "@/server/actions/offers";
import { listCreatorsForDirectOffer } from "@/server/queries/creators";

const weekdays = [["0","日"],["1","月"],["2","火"],["3","水"],["4","木"],["5","金"],["6","土"]] as const;

export default async function NewDirectOfferPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const creators = await listCreatorsForDirectOffer();

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
        <span className="eyebrow">ONE CREATOR</span>
        <h1>1人を指名して、有償PRを依頼。</h1>
        <p>
          公開募集ではなく、特定のCreatorだけに報酬・条件・候補日時を提示します。
          Creatorは条件を確認して、そのまま来店可能日時を選べます。
        </p>
      </section>

      {message ? <div className="form-message">{message}</div> : null}

      <form action={createDirectOffer} className="campaign-form">
        <section className="form-section">
          <span className="eyebrow">01 CREATOR</span>
          <h2>依頼するCreatorを1人選択</h2>

          {creators.length ? (
            <div className="creator-picker">
              {creators.map((creator) => (
                <label className="creator-option" key={creator.id}>
                  <input name="creatorId" required type="radio" value={creator.id} />
                  <div>
                    <strong>{creator.displayName}</strong>
                    <span>{creator.baseArea}</span>
                    <p>
                      Instagram {creator.followers.toLocaleString()} followers
                      {creator.minReward > 0
                        ? ` ・ 希望報酬 ¥${creator.minReward.toLocaleString()}〜`
                        : ""}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <div className="form-message">
              指名できるCreatorがまだ登録されていません。
            </div>
          )}
        </section>

        <section className="form-section">
          <span className="eyebrow">02 OFFER</span>
          <h2>依頼内容</h2>

          <label>
            タイトル
            <input
              name="title"
              placeholder="グルメ日誌様へ 焼肉コースPRのご依頼"
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
              <input name="area" placeholder="梅田" required />
            </label>
          </div>

          <label>
            依頼内容
            <textarea
              name="description"
              placeholder="新コースの紹介、撮影してほしい料理など"
              rows={4}
            />
          </label>
        </section>

        <section className="form-section">
          <span className="eyebrow">03 REWARD</span>
          <h2>報酬と来店人数</h2>

          <div className="field-row">
            <label>
              現金報酬（税込）
              <input defaultValue="6000" min="0" name="cashReward" required type="number" />
            </label>
            <label>
              来店人数
              <select defaultValue="0" name="maxCompanions">
                <option value="0">1名限定（Creator本人のみ）</option>
                <option value="1">1〜2名（同伴1名まで）</option>
                <option value="2">1〜3名（同伴2名まで）</option>
              </select>
            </label>
          </div>

          <label>
            食事提供
            <input defaultValue="1名分提供" name="foodOffer" />
          </label>
        </section>

        <section className="form-section">
          <span className="eyebrow">04 DELIVERABLE</span>
          <h2>必須投稿</h2>

          <div className="check-grid">
            <label>
              <input defaultChecked name="platforms" type="checkbox" value="instagram_reel" />
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
          <span className="eyebrow">05 SCHEDULE</span>
          <h2>来店候補</h2>

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

          <span className="field-caption">候補曜日</span>
          <div className="weekday-grid">
            {weekdays.map(([value, label]) => (
              <label key={value}>
                <input
                  defaultChecked={["1","2","3","4"].includes(value)}
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
              開始時間
              <input defaultValue="17:00" name="startTime" required type="time" />
            </label>
            <label>
              終了時間
              <input defaultValue="21:00" name="endTime" required type="time" />
            </label>
          </div>

          <div className="field-row">
            <label>
              候補間隔
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
          </div>

          <label>
            オファー回答期限
            <input name="applicationDeadline" required type="datetime-local" />
          </label>
        </section>

        <button className="primary-button publish-button" disabled={!creators.length} type="submit">
          このCreatorへ有償オファーを送る
        </button>
      </form>
    </main>
  );
}
