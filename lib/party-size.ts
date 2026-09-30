export function normalizeMaxCompanions(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(10, Math.floor(value)));
}

export function buildPartySizes(maxCompanions: number) {
  const normalized = normalizeMaxCompanions(maxCompanions);
  return Array.from({ length: normalized + 1 }, (_, index) => index + 1);
}

export function defaultPartySize() {
  return 1;
}

export function partySizeLabel(value: number) {
  return value === 1 ? "1名（ひとり）" : `${value}名`;
}
