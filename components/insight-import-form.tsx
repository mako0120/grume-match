"use client";

import { useMemo, useState } from "react";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  formatCompactViews,
  formatPercent,
  parseInsightLines,
  summarizePerformance,
} from "@/lib/creator-performance";
import { importInsights } from "@/server/actions/performance";

const EXAMPLE = [
  "淡路市 / 刺身好きなら一度は行きたい / 2.7万 / 1,106 / 27 / 12 / 5 / 3週間",
  "松原 / 泡系豚骨 一度は食べたい / 9,786 / 728 / 1 / 4 / 2 / 3週間",
].join("\n");

// Paste rows read off the insights screen; the preview updates as you type.
export function InsightImportForm({ today }: { today: string }) {
  const [text, setText] = useState("");
  const [measuredOn, setMeasuredOn] = useState(today);
  const [platform, setPlatform] = useState("instagram");

  const parsed = useMemo(
    () => (measuredOn ? parseInsightLines(text, measuredOn) : { rows: [], errors: [] }),
    [text, measuredOn],
  );

  const preview = useMemo(
    () =>
      summarizePerformance(
        parsed.rows.map((row) => ({ ...row, platform, measuredOn, verified: false })),
        { today },
      ),
    [parsed.rows, platform, measuredOn, today],
  );

  const outsideWindow = parsed.rows.length - (preview?.postCount ?? 0);
  const canSubmit = parsed.rows.length > 0 && parsed.errors.length === 0;

  return (
    <form action={importInsights} className="campaign-form insight-form">
      <div className="field-row">
        <label>
          SNS
          <select name="platform" onChange={(event) => setPlatform(event.target.value)} value={platform}>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="youtube">YouTube</option>
            <option value="threads">Threads</option>
          </select>
        </label>
        <label>
          計測日（スクショの日）
          <input
            max={today}
            name="measuredOn"
            onChange={(event) => setMeasuredOn(event.target.value)}
            required
            type="date"
            value={measuredOn}
          />
        </label>
      </div>

      <label>
        インサイトの数字を1投稿1行で貼り付け
        <textarea
          name="insights"
          onChange={(event) => setText(event.target.value)}
          placeholder={EXAMPLE}
          rows={9}
          spellCheck={false}
          value={text}
        />
      </label>
      <p className="field-help">
        順番：エリア / 見出し / 閲覧数 / いいね / コメント / リポスト / シェア / 投稿時期。
        「2.7万」「1,106」「3週間」「4日」はそのまま入力できます。見出しは省略可、投稿URL（https://）を行のどこかに入れるとリンクになります。
      </p>

      {parsed.errors.length ? (
        <ul className="form-message error-message insight-errors" aria-live="polite">
          {parsed.errors.slice(0, 5).map((error) => (
            <li key={error.line}>
              {error.line}行目：{error.reason}
            </li>
          ))}
        </ul>
      ) : null}

      {preview ? (
        <div className="insight-preview" aria-live="polite">
          <strong>
            {preview.postCount}投稿・合計{preview.viewsApprox ? "約" : ""}
            {formatCompactViews(preview.totalViews)}閲覧・中央値
            {formatCompactViews(preview.medianViews)}・反応率{formatPercent(preview.engagementRate)}
          </strong>
          {outsideWindow > 0 ? (
            <span>30日より前の{outsideWindow}投稿は保存されますが集計には含みません。</span>
          ) : null}
        </div>
      ) : null}

      <p className="field-help">
        同じSNS・同じ計測日のデータは置き換わります。毎月1回、最新のインサイトで更新してください。
      </p>

      <PendingSubmitButton
        disabled={!canSubmit}
        idleLabel={canSubmit ? `${parsed.rows.length}投稿を保存` : "貼り付けると保存できます"}
        pendingLabel="保存中..."
      />
    </form>
  );
}
