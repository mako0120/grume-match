"use client";

import { useState } from "react";
import {
  calculateDiaryMonthlyProfit, DEFAULT_DIARY_PROFIT_SCENARIO,
  type DiaryProfitScenario,
} from "@/lib/diary/retainers";

const yen = (amount: number) =>
  new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(amount);
const fields: { key: Exclude<keyof DiaryProfitScenario, "taxable">; label: string; max: number }[] = [
  { key: "monthlyPhoto", label: "毎月フォトPR（月29,800円）の契約数", max: 30 },
  { key: "monthlyGrowth", label: "毎月フォト＋リールPR（月49,800円）の契約数", max: 30 },
  { key: "oneOffVideo", label: "単発動画込みPR（月15,000円想定）の件数", max: 30 },
  { key: "hourlyOwnerCostYen", label: "自分の1時間当たりの労務コスト（円）", max: 30000 },
  { key: "fixedMonthlyExpenseYen", label: "毎月の固定経費（円）", max: 1000000 },
];

export function DiaryProfitPlanner() {
  const [scenario, setScenario] = useState<DiaryProfitScenario>(DEFAULT_DIARY_PROFIT_SCENARIO);
  const result = calculateDiaryMonthlyProfit(scenario);

  function update(key: Exclude<keyof DiaryProfitScenario, "taxable">, raw: string, max: number) {
    const num = Number(raw);
    if (!Number.isFinite(num)) return;
    setScenario(prev => ({ ...prev, [key]: Math.max(0, Math.min(max, Math.trunc(num))) }));
  }

  return <section className="ops-profit-planner" aria-labelledby="ops-profit-planner-heading">
    <div className="ops-panel-heading">
      <div><span className="ops-eyebrow">RETAINER UNIT ECONOMICS / SIMULATION</span>
        <h2 id="ops-profit-planner-heading">月次売上・利益シミュレーション</h2>
      </div>
    </div>
    <p>以下は**架空の販売数と原価仮定**による事業計画です。実際の成約件数・MRR・未入金額ではありません。入力情報は保存・外部送信しません。</p>
    <div className="ops-profit-inputs">
      {fields.map(f => <label key={f.key}>{f.label}
        <input type="number" min={0} max={f.max} step={f.key.startsWith("monthly") || f.key === "oneOffVideo" ? 1 : 500}
          value={scenario[f.key]}
          onChange={event => update(f.key, event.target.value, f.max)} />
      </label>)}
      <label className="ops-profit-tax"><input type="checkbox" checked={scenario.taxable}
        onChange={event => setScenario(prev => ({ ...prev, taxable: event.target.checked }))} />
        消費税の納税事業者として、税込売上から10%相当の消費税を除いて試算
      </label>
    </div>
    <div className="ops-profit-results" aria-live="polite">
      <div><span>月額契約・想定件数</span><strong>{result.recurringContracts}店舗</strong></div>
      <div><span>継続プラン月額売上（税込）</span><strong>{yen(result.recurringSalesInclTaxYen)}</strong></div>
      <div><span>合計月商（税込）</span><strong>{yen(result.monthlySalesInclTaxYen)}</strong></div>
      <div><span>消費税を除いた想定売上</span><strong>{yen(result.netRevenueYen)}</strong></div>
      <div><span>交通・制作等の直接費</span><strong>−{yen(result.directCostsYen)}</strong></div>
      <div><span>自分の労務時間・コスト</span><strong>{result.ownerHours}時間 / −{yen(result.ownerLaborCostYen)}</strong></div>
      <div><span>固定経費</span><strong>−{yen(result.fixedMonthlyExpenseYen)}</strong></div>
      <div className="ops-profit-surplus"><span>労務費を引いた概算事業利益（税引前）</span><strong>{yen(result.operatingSurplusAfterOwnerLaborYen)}</strong></div>
    </div>
    <p className="ops-profit-note">前提：1店舗・月1回来店。写真プランは5時間＋経費2,500円、写真＋動画は9時間＋経費4,500円、単発動画は5時間＋経費3,000円の**仮定**です。単発価格はモデル用15,000円。食材費、外注費、税務、実際の原価は案件ごとに確認してください。赤字でも結果をそのまま表示します。</p>
  </section>;
}
