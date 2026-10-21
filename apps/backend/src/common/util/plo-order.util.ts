// PLO has no sortOrder column and none of its queries has an orderBy, so rows came
// back in Postgres's physical order (an edited or re-created PLO5 can sit ahead of
// PLO1). Ordering by code in plain SQL would put PLO10 before PLO2, so every list
// of PLOs goes through here after it is fetched. Order only: no value is touched.
const PLO_CODE = /^PLO\s*(\d+)$/i;

// PLO1, PLO2, ... PLO10 by number first; any other shape of code follows them,
// in natural order (numbers inside the text compared as numbers), so the result
// is the same whatever order the rows arrive in.
export function comparePloCode(a: string, b: string): number {
  const na = PLO_CODE.exec(a.trim());
  const nb = PLO_CODE.exec(b.trim());
  if (na && nb) return Number(na[1]) - Number(nb[1]) || compareText(a, b);
  if (na) return -1;
  if (nb) return 1;
  return compareText(a, b);
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}

// A new array; the input is left as it is.
export function sortByPloCode<T extends { code: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => comparePloCode(a.code, b.code));
}
