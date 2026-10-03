// SIGNAL attribution metrics (P3-01). Pure functions over the rows returned
// by the restaurant_signal_summary() database function.

const CODE_ALPHABET = /^[A-HJ-NP-Z2-9]{8}$/;

/** Accepts what a guest or staff member might type: "abcd-efgh", " ABCD EFGH ". */
export function normalizeSignalCode(input: string) {
  return input.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function isSignalCode(input: string) {
  return CODE_ALPHABET.test(normalizeSignalCode(input));
}

/** Display form that is easy to read out loud: ABCD-EFGH. */
export function formatSignalCode(code: string) {
  const normalized = normalizeSignalCode(code);
  return normalized.length === 8
    ? `${normalized.slice(0, 4)}-${normalized.slice(4)}`
    : normalized;
}

export type SignalSummaryRow = {
  tracking_link_id: string;
  code: string;
  booking_id: string;
  campaign_id: string;
  campaign_title: string;
  creator_name: string;
  visit_starts_at: string;
  disabled: boolean;
  cost_yen: number;
  landing_views: number;
  visits: number;
  visit_guests: number;
  revenue_yen: number | string;
};

export type SignalTotals = {
  costYen: number;
  landingViews: number;
  visits: number;
  visitGuests: number;
  revenueYen: number;
};

export type SignalMetrics = SignalTotals & {
  costPerVisit: number | null;
  /** Revenue ÷ cost. 1.0 means the PR paid for itself. */
  roas: number | null;
  /** Share of landing views that turned into a recorded visit. */
  visitRate: number | null;
};

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

export function deriveSignalMetrics(totals: SignalTotals): SignalMetrics {
  return {
    ...totals,
    costPerVisit: totals.visits > 0 ? Math.round(totals.costYen / totals.visits) : null,
    roas: ratio(totals.revenueYen, totals.costYen),
    visitRate: ratio(totals.visits, totals.landingViews),
  };
}

function totalsOf(rows: SignalSummaryRow[]): SignalTotals {
  return rows.reduce<SignalTotals>(
    (sum, row) => ({
      costYen: sum.costYen + row.cost_yen,
      landingViews: sum.landingViews + row.landing_views,
      visits: sum.visits + row.visits,
      visitGuests: sum.visitGuests + row.visit_guests,
      // bigint aggregates arrive as strings from PostgREST.
      revenueYen: sum.revenueYen + Number(row.revenue_yen),
    }),
    {
      costYen: 0,
      landingViews: 0,
      visits: 0,
      visitGuests: 0,
      revenueYen: 0,
    },
  );
}

export type SignalCreatorRow = SignalMetrics & {
  trackingLinkId: string;
  code: string;
  bookingId: string;
  campaignTitle: string;
  creatorName: string;
  visitStartsAt: string;
  disabled: boolean;
};

export function summarizeSignal(rows: SignalSummaryRow[]) {
  const creators: SignalCreatorRow[] = rows
    .map((row) => ({
      ...deriveSignalMetrics(totalsOf([row])),
      trackingLinkId: row.tracking_link_id,
      code: row.code,
      bookingId: row.booking_id,
      campaignTitle: row.campaign_title,
      creatorName: row.creator_name,
      visitStartsAt: row.visit_starts_at,
      disabled: row.disabled,
    }))
    .sort(
      (a, b) =>
        b.visits - a.visits ||
        b.landingViews - a.landingViews ||
        b.visitStartsAt.localeCompare(a.visitStartsAt),
    );

  return {
    totals: deriveSignalMetrics(totalsOf(rows)),
    creators,
  };
}

export function formatYen(value: number | null) {
  return value === null ? "—" : `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

export function formatPercent(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

export function formatRoas(value: number | null) {
  return value === null ? "—" : `${value.toFixed(2)}倍`;
}

export const SIGNAL_RETENTION_MONTHS = 13;
