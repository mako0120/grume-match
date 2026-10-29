/**
 * グルメ日誌の月次PR「提案」プラン。フォーム送信=契約/決済ではない。
 * 税込料金のみ公開する。実際の価格・制作範囲・更新・利用許諾は書面で合意。
 */
export const DIARY_RETAINER_PLANS = [
  {
    id: "monthly_photo",
    name: "毎月フォトPR",
    priceYenInclTax: 29800,
    type: "photo",
    subtitle: "新メニューを、毎月きちんと紹介",
    features: [
      "月1回の店舗訪問・撮影（1店舗・1拠点）",
      "グルメ日誌のInstagram写真フィード1投稿",
      "告知用ストーリーズ1回",
      "投稿後の簡易インサイト共有",
    ],
    estimatedOwnerHours: 5,
    estimatedOutOfPocketYen: 2500,
  },
  {
    id: "monthly_growth",
    name: "毎月フォト＋リールPR",
    priceYenInclTax: 49800,
    type: "video",
    subtitle: "写真と動画で、季節ごとに魅力を届ける",
    features: [
      "月1回の店舗訪問・写真・動画撮影（1店舗・1拠点）",
      "グルメ日誌の写真フィード1投稿＋リール1本",
      "告知用ストーリーズ1回",
      "投稿後の簡易インサイト共有",
    ],
    estimatedOwnerHours: 9,
    estimatedOutOfPocketYen: 4500,
  },
] as const;

export type DiaryRetainerId = (typeof DIARY_RETAINER_PLANS)[number]["id"];
export const DIARY_RETAINER_COMMON_CONDITIONS = [
  "料金は税込・店舗1拠点あたりの月額提案価格。正式契約前に制作範囲と日程を合意。",
  "原則、月1回の撮影。原稿の事実確認に伴う軽微な修正は1回。追加撮影・追加制作は別途見積。",
  "移動交通費と必要な飲食費の負担は事前に明示。広告配信、店舗アカウントの運用代行、素材の二次利用・広告利用は含まれません。",
  "次月の制作は都度双方が明示合意。フォーム送信で契約・自動更新・自動課金は発生しません。",
  "投稿には適切なPR表示を付し、再生数・来店者数・売上は保証しません。",
] as const;

export function retainerPlan(id: string) {
  return DIARY_RETAINER_PLANS.find(plan => plan.id === id) ?? null;
}

/** Assumptions, NOT recorded transactions, confirmed contracts or actual MRR. */
export type DiaryProfitScenario = {
  monthlyPhoto: number;
  monthlyGrowth: number;
  oneOffVideo: number;
  hourlyOwnerCostYen: number;
  fixedMonthlyExpenseYen: number;
  videoOneOffFeeInclTaxYen: number;
  videoOneOffHours: number;
  videoOneOffCashCostYen: number;
  // Taxable businesses should exclude the 10% consumption tax from revenue.
  taxable: boolean;
};

export const DEFAULT_DIARY_PROFIT_SCENARIO: DiaryProfitScenario = {
  monthlyPhoto: 3,
  monthlyGrowth: 4,
  oneOffVideo: 1,
  hourlyOwnerCostYen: 2000,
  fixedMonthlyExpenseYen: 15000,
  videoOneOffFeeInclTaxYen: 15000,
  videoOneOffHours: 5,
  videoOneOffCashCostYen: 3000,
  taxable: true,
};

function validAmount(value: number) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 100000000;
}

/** Cash projection: keeps the owner's working time as an explicit opportunity cost. */
export function calculateDiaryMonthlyProfit(s: DiaryProfitScenario) {
  const amounts = [
    s.monthlyPhoto, s.monthlyGrowth, s.oneOffVideo,
    s.hourlyOwnerCostYen, s.fixedMonthlyExpenseYen,
    s.videoOneOffFeeInclTaxYen, s.videoOneOffHours, s.videoOneOffCashCostYen,
  ];
  if (amounts.some(value => !validAmount(value)) || typeof s.taxable !== "boolean" ||
      s.monthlyPhoto > 1000 || s.monthlyGrowth > 1000 || s.oneOffVideo > 1000 ||
      s.hourlyOwnerCostYen > 100000 || s.videoOneOffHours > 1000) {
    throw new Error("Invalid scenario");
  }
  const [photo, growth] = DIARY_RETAINER_PLANS;
  const recurringSalesInclTaxYen =
    photo.priceYenInclTax * s.monthlyPhoto + growth.priceYenInclTax * s.monthlyGrowth;
  const monthlySalesInclTaxYen = recurringSalesInclTaxYen +
    s.videoOneOffFeeInclTaxYen * s.oneOffVideo;
  const netRevenueYen = s.taxable ? Math.round(monthlySalesInclTaxYen / 1.1) : monthlySalesInclTaxYen;
  const estimatedTaxIncludedYen = monthlySalesInclTaxYen - netRevenueYen;
  const directCostsYen =
    photo.estimatedOutOfPocketYen * s.monthlyPhoto +
    growth.estimatedOutOfPocketYen * s.monthlyGrowth +
    s.videoOneOffCashCostYen * s.oneOffVideo;
  const ownerHours =
    photo.estimatedOwnerHours * s.monthlyPhoto +
    growth.estimatedOwnerHours * s.monthlyGrowth +
    s.videoOneOffHours * s.oneOffVideo;
  const ownerLaborCostYen = ownerHours * s.hourlyOwnerCostYen;
  const contributionAfterCashYen = netRevenueYen - directCostsYen;
  const operatingSurplusAfterOwnerLaborYen =
    contributionAfterCashYen - ownerLaborCostYen - s.fixedMonthlyExpenseYen;
  return {
    recurringContracts: s.monthlyPhoto + s.monthlyGrowth,
    recurringSalesInclTaxYen,
    monthlySalesInclTaxYen,
    netRevenueYen,
    estimatedTaxIncludedYen,
    directCostsYen,
    ownerHours,
    ownerLaborCostYen,
    fixedMonthlyExpenseYen: s.fixedMonthlyExpenseYen,
    contributionAfterCashYen,
    operatingSurplusAfterOwnerLaborYen,
    operatingMarginPercent: netRevenueYen > 0
      ? Math.round(1000 * operatingSurplusAfterOwnerLaborYen / netRevenueYen) / 10 : 0,
  };
}
