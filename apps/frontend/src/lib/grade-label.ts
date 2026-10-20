import type { Grade } from '@eduanalyze-ai/shared-types';

// Shared between the add-record form's grade <Select> and the records
// table's display/inline-edit — one place for the enum-value -> Thai/plus
// notation mapping (CONVENTIONS §6: reuse, don't duplicate).
export const GRADE_LABELS: Record<Grade, string> = {
  A: 'A',
  B_PLUS: 'B+',
  B: 'B',
  C_PLUS: 'C+',
  C: 'C',
  D_PLUS: 'D+',
  D: 'D',
  F: 'F',
  W: 'W',
  I: 'I',
  S: 'S',
  U: 'U',
};

export const GRADE_OPTIONS = Object.keys(GRADE_LABELS) as Grade[];

export const SEMESTER_TERM_LABELS: Record<string, string> = {
  FIRST: 'ภาคต้น',
  SECOND: 'ภาคปลาย',
  SUMMER: 'ภาคฤดูร้อน',
};

export function formatSemesterLabel(term: string, year: number | undefined): string {
  const termLabel = SEMESTER_TERM_LABELS[term] ?? term;
  return year ? `${termLabel} / ${year}` : termLabel;
}
