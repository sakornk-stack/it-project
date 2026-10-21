// Same rule as the backend's common/util/plo-order.util.ts (shared-types holds types
// only, so the few lines are repeated): PLO1, PLO2, ... PLO10 by number, any other
// shape of code after them in natural order. The API already returns PLOs in this
// order; this is for lists the page sorts itself (e.g. the "by code" sort mode), so
// PLO10 never lands before PLO2.
const PLO_CODE = /^PLO\s*(\d+)$/i;

function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}

export function comparePloCode(a: string, b: string): number {
  const na = PLO_CODE.exec(a.trim());
  const nb = PLO_CODE.exec(b.trim());
  if (na && nb) return Number(na[1]) - Number(nb[1]) || compareText(a, b);
  if (na) return -1;
  if (nb) return 1;
  return compareText(a, b);
}

// A new array; the input is left as it is.
export function sortByPloCode<T extends { code: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => comparePloCode(a.code, b.code));
}
