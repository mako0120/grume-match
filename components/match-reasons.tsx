import type { MatchResult } from "@/lib/matching";

/** Why this Creator fits (or does not fit) — shown to both sides. */
export function MatchReasons({
  match,
  compact = false,
}: {
  match: Pick<MatchResult, "label" | "reasons" | "cautions" | "blocked">;
  compact?: boolean;
}) {
  const reasons = compact ? match.reasons.slice(0, 2) : match.reasons;
  const cautions = compact ? match.cautions.slice(0, 1) : match.cautions;

  if (!match.label && !reasons.length && !cautions.length) return null;

  return (
    <div className="match-reasons">
      {match.label ? (
        <span className={match.label === "とても合う" ? "match-label is-strong" : "match-label"}>
          {match.label}
        </span>
      ) : null}
      {reasons.map((reason) => (
        <span className="match-reason" key={reason}>
          {reason}
        </span>
      ))}
      {cautions.map((caution) => (
        <span className="match-caution" key={caution}>
          {caution}
        </span>
      ))}
    </div>
  );
}
