import {
  describeUsageRights,
  licenseState,
  licenseStateLabels,
} from "@/lib/content-rights";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function UsageLicenseSummary({
  license,
}: {
  license: {
    usageScope: "organic" | "organic_and_ads";
    durationDays: number;
    fee: number;
    status: string;
    expiresAt: string | null;
  };
}) {
  const { state, daysLeft } = licenseState(license);

  return (
    <section className={`license-card license-${state}`}>
      <div className="deliverable-head">
        <strong>素材の二次利用</strong>
        <span className="status-chip">{licenseStateLabels[state]}</span>
      </div>
      <p>{describeUsageRights(license)}</p>
      {license.expiresAt ? (
        <p className="license-expiry">
          {state === "expired"
            ? `${dateFormatter.format(new Date(license.expiresAt))}に期限切れ`
            : `${dateFormatter.format(new Date(license.expiresAt))}まで（残り${daysLeft}日）`}
        </p>
      ) : (
        <p className="license-expiry">納品物の承認日から{license.durationDays}日間</p>
      )}
    </section>
  );
}
