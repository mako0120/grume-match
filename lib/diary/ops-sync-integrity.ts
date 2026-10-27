/** A partial or inconsistent ledger must not authorize accounting actions. */
export function hasCompleteOpsSnapshot(
  leadIds: readonly string[], savedIds: readonly string[], truncated: boolean,
): boolean {
  if (truncated || leadIds.length !== savedIds.length) return false;
  const leads = new Set(leadIds);
  const saved = new Set(savedIds);
  if (leads.size !== leadIds.length || saved.size !== savedIds.length) return false;
  return leadIds.every(id => saved.has(id));
}
