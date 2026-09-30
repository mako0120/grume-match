import Link from "next/link";
import { createDirectOffer } from "@/server/actions/offers";
import { listCreatorsForDirectOffer } from "@/server/queries/creators";

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
        <span className="eyebrow">SIMPLE OFFER</span>
        <h1>1人選ぶ。条件を出す。送る。</h1>
        <p>
          価格交渉はありません。Creatorは提示条件で参加する場合だけ、
          候補日時をタップして応募します。
        </p>
      </section>

      {message ? <div className="form-message">{message}</div> : null}

      <form action={createDirectOffer} className="campaign-form">
        <section className="form-section">
          <span className="eyebrow">01 CREATOR</span>
          <h2>依頼する人</h2>

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
                        ? " ・ 目安 ¥" + creator.minReward.toLocaleString() + "〜"
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

        <button className="primary-button publish-button" disabled={!creators.length} type="submit">
          この条件で送る
        </button>
      </form>
    </main>
  );
}
