import { USAGE_DURATIONS } from "@/lib/content-rights";

// Shared form fields for structured content usage rights. Secondary use is
// opt-in, time-limited and priced; there is no perpetual option.
export function UsageRightsFields() {
  return (
    <section className="form-section">
      <span className="eyebrow">USAGE RIGHTS</span>
      <h2>素材の二次利用</h2>
      <p className="field-help">
        Creatorの写真・動画を店舗のSNS・Webや広告で使う場合だけ設定します。期間は承認日から数え、期限後は素材ライブラリから開けなくなります。
      </p>

      <label>
        利用範囲
        <select defaultValue="none" name="usageMode">
          <option value="none">二次利用しない（Creatorの投稿のみ）</option>
          <option value="organic">店舗のSNS・Webで利用</option>
          <option value="organic_and_ads">店舗のSNS・Web＋広告で利用</option>
        </select>
      </label>

      <div className="field-row">
        <label>
          利用期間
          <select defaultValue="90" name="usageDurationDays">
            {USAGE_DURATIONS.map((days) => (
              <option key={days} value={days}>
                {days}日
              </option>
            ))}
          </select>
        </label>

        <label>
          二次利用料（税込）
          <input
            defaultValue="0"
            max="1000000"
            min="0"
            name="usageFee"
            step="500"
            type="number"
          />
        </label>
      </div>

      <p className="field-help">
        二次利用料は現金報酬に上乗せしてCreatorへ支払います。広告で使う場合は1円以上が必要です。UGC写真・動画を依頼する場合は二次利用の設定が必須です。
      </p>
    </section>
  );
}
