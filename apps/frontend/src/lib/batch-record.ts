import type { SemesterTerm } from '@eduanalyze-ai/shared-types';

// Pure helpers for the multi-course "add records" form: a semester is picked
// as year + term, and every course row in one save shares that semester.

export interface BatchSemesterOption {
  id: string;
  year: number | undefined;
  term: SemesterTerm;
}

export interface BatchYear {
  year: number;
  // Only the terms that exist for this year, in teaching order.
  terms: { term: SemesterTerm; semesterId: string }[];
}

const TERM_ORDER: Record<SemesterTerm, number> = { FIRST: 1, SECOND: 2, SUMMER: 3 };

// Newest year first; semesters without a known year are left out.
export function groupSemestersByYear(semesters: readonly BatchSemesterOption[]): BatchYear[] {
  const byYear = new Map<number, BatchYear>();
  for (const s of semesters) {
    if (s.year === undefined) continue;
    const entry = byYear.get(s.year) ?? { year: s.year, terms: [] };
    entry.terms.push({ term: s.term, semesterId: s.id });
    byYear.set(s.year, entry);
  }
  for (const entry of byYear.values())
    entry.terms.sort((a, b) => TERM_ORDER[a.term] - TERM_ORDER[b.term]);
  return [...byYear.values()].sort((a, b) => b.year - a.year);
}

// The term a student most likely enters next: the first regular (non-summer)
// term after their latest recorded one, or that latest term itself when none
// comes after it; with no records yet, the earliest term of the newest year.
export function defaultSemesterId(
  years: readonly BatchYear[],
  recordedSemesterIds: ReadonlySet<string>,
): string | null {
  const chronological = [...years].reverse().flatMap((y) => y.terms);
  if (chronological.length === 0) return null;
  let latest = -1;
  chronological.forEach((t, i) => {
    if (recordedSemesterIds.has(t.semesterId)) latest = i;
  });
  if (latest === -1) return years[0].terms[0]?.semesterId ?? null;
  const next = chronological.slice(latest + 1).find((t) => t.term !== 'SUMMER');
  return (next ?? chronological[latest]).semesterId;
}

// Courses one row may still pick: not chosen in another row of this save and
// not already recorded in the chosen semester (the API would refuse those).
export function selectableCourseIds(
  allCourseIds: readonly string[],
  rowCourseIds: readonly (string | null)[],
  rowIndex: number,
  recordedInSemester: ReadonlySet<string>,
): string[] {
  const takenByOtherRows = new Set(rowCourseIds.filter((id, i) => id && i !== rowIndex));
  return allCourseIds.filter((id) => !takenByOtherRows.has(id) && !recordedInSemester.has(id));
}
