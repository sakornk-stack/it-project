import type {
  CloDetail,
  CloPloMappingItem,
  CourseListItem,
  PloListItem,
} from '@eduanalyze-ai/shared-types';

// What the CLO/PLO page shows, derived from the lists the API returns. Kept free of React.

export const OUTCOME_EFFECT_WARNING = 'การแก้มีผลกับผล PLO ของนิสิตทันที';

const byCode = (a: { code: string }, b: { code: string }) =>
  a.code.localeCompare(b.code, 'en', { numeric: true });

export interface CourseRow {
  course: CourseListItem;
  cloCount: number;
  unconfirmedCount: number;
}

// One row per course of the curriculum, with its CLO counts, in code order.
export function courseRows(
  courses: CourseListItem[],
  clos: CloDetail[],
  curriculumId: string,
): CourseRow[] {
  const total = new Map<string, number>();
  const pending = new Map<string, number>();
  for (const clo of clos) {
    total.set(clo.courseId, (total.get(clo.courseId) ?? 0) + 1);
    if (!clo.isConfirmed) pending.set(clo.courseId, (pending.get(clo.courseId) ?? 0) + 1);
  }
  return courses
    .filter((c) => c.curriculumId === curriculumId)
    .sort(byCode)
    .map((course) => ({
      course,
      cloCount: total.get(course.id) ?? 0,
      unconfirmedCount: pending.get(course.id) ?? 0,
    }));
}

export function filterCourseRows(
  rows: CourseRow[],
  search: string,
  onlyUnconfirmed: boolean,
): CourseRow[] {
  const q = search.trim().toLowerCase();
  return rows.filter(({ course, unconfirmedCount }) => {
    if (onlyUnconfirmed && unconfirmedCount === 0) return false;
    if (!q) return true;
    return `${course.code} ${course.name} ${course.nameEn ?? ''}`.toLowerCase().includes(q);
  });
}

export type CourseFlag = 'NO_CLO' | 'UNCONFIRMED';

export const COURSE_FLAG_LABELS: Record<CourseFlag, string> = {
  NO_CLO: 'ยังไม่มี CLO',
  UNCONFIRMED: 'มี CLO ที่ยังไม่ยืนยัน',
};

// A course with unconfirmed CLOs is flagged for that first; "no CLO" is for an empty course.
export function courseFlag(
  row: Pick<CourseRow, 'cloCount' | 'unconfirmedCount'>,
): CourseFlag | null {
  if (row.cloCount === 0) return 'NO_CLO';
  return row.unconfirmedCount > 0 ? 'UNCONFIRMED' : null;
}

// The CLOs of the selected course, in code order; optionally only the unconfirmed ones.
export function cloCards(clos: CloDetail[], courseId: string, onlyUnconfirmed: boolean) {
  return clos
    .filter((c) => c.courseId === courseId && (!onlyUnconfirmed || !c.isConfirmed))
    .sort(byCode);
}

export interface PloChip {
  ploId: string;
  code: string;
  weight: number;
}

// The PLOs one CLO answers, e.g. "PLO2 ×3".
export function ploChips(
  cloId: string,
  mappings: CloPloMappingItem[],
  plos: PloListItem[],
): PloChip[] {
  const codeById = new Map(plos.map((p) => [p.id, p.code]));
  return mappings
    .filter((m) => m.cloId === cloId && codeById.has(m.ploId))
    .map((m) => ({
      ploId: m.ploId,
      code: codeById.get(m.ploId) as string,
      weight: m.weight,
    }))
    .sort(byCode);
}

export const chipLabel = (chip: PloChip) => `${chip.code} ×${chip.weight}`;

// How many CLOs answer a PLO (shown on the PLO tab).
export function cloCountOfPlo(ploId: string, mappings: CloPloMappingItem[]): number {
  return mappings.filter((m) => m.ploId === ploId).length;
}

export interface OutcomeStats {
  courses: number;
  coursesWithClo: number;
  unconfirmed: number;
}

// The three figures above the page, from the rows already loaded.
export function outcomeStats(rows: CourseRow[]): OutcomeStats {
  return {
    courses: rows.length,
    coursesWithClo: rows.filter((r) => r.cloCount > 0).length,
    unconfirmed: rows.reduce((sum, r) => sum + r.unconfirmedCount, 0),
  };
}
