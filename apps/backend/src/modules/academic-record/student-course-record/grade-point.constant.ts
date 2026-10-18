import { Grade, SemesterTerm } from '@prisma/client';

// Thai national grade-point scale. null = does not affect GPA (excluded
// from both numerator and denominator) — W (withdrawn), I (incomplete),
// S/U (satisfactory/unsatisfactory, non-credit-bearing-for-GPA courses
// like Cooperative Education).
export const GRADE_POINTS: Record<Grade, number | null> = {
  A: 4.0,
  B_PLUS: 3.5,
  B: 3.0,
  C_PLUS: 2.5,
  C: 2.0,
  D_PLUS: 1.5,
  D: 1.0,
  F: 0.0,
  W: null,
  I: null,
  S: null,
  U: null,
};

// A to F: the grades that enter the statistics (GPA, grade distribution). W, I,
// S and U do not. This is the "people with a grade" base for sample-size notes.
export const isLetterGrade = (grade: Grade): boolean => GRADE_POINTS[grade] !== null;

// Chronological order within a Thai academic year (1st sem ~Aug-Dec,
// 2nd sem ~Jan-May, Summer ~Jun-Jul) — used to resolve "latest attempt"
// when a student retakes a course.
export const SEMESTER_TERM_RANK: Record<SemesterTerm, number> = {
  FIRST: 1,
  SECOND: 2,
  SUMMER: 3,
};

// Pass/fail status for Smart Credit Checker (Phase 7) — a DIFFERENT
// question from GRADE_POINTS above (GPA effect). S counts as PASS here
// (credits earned) even though it has no GPA effect (matches real use for
// non-GPA courses like Cooperative Education) — confirmed product
// decision, not an oversight. W/I are EXCLUDED from both studied and
// passed — a withdrawn/incomplete course lands in the same
// "not yet studied" bucket as a course never attempted, rather than a
// separate withdrawn/incomplete bucket — also a confirmed decision.
// CLO Achievement bar (Phase 8, PROJECT_CONTEXT.md §22): "Grade B ขึ้นไป
// = ผ่านเกณฑ์ Achievement" — a stricter bar than GRADE_STATUS's PASS
// (which includes C/D-range grades for Phase 7's credit-counting
// purposes). A separate concept from GRADE_STATUS, hardcoded per §22's
// example rather than configurable per CLO/course in this phase.
export const ACHIEVED_GRADES: ReadonlySet<Grade> = new Set<Grade>([
  'A',
  'B_PLUS',
  'B',
]);

// Instructor dashboard's at-risk alert — C and below (C+ deliberately
// excluded, confirmed product decision). Not ACHIEVED_GRADES' complement:
// C+ misses the B bar but isn't flagged as at-risk.
export const AT_RISK_GRADES: ReadonlySet<Grade> = new Set<Grade>([
  'C',
  'D_PLUS',
  'D',
  'F',
  'U',
]);

export type RiskLevel = 'CRITICAL' | 'WATCH' | 'NORMAL';

// The severe end of AT_RISK_GRADES: a failing grade (F/U) or one that
// earns credit but sits at the bottom of the passing range (D/D+).
export const CRITICAL_GRADES: ReadonlySet<Grade> = new Set<Grade>([
  'D_PLUS',
  'D',
  'F',
  'U',
]);

// Per-course band, used by the Instructor pages only (one grade in one
// course). WATCH is whatever AT_RISK_GRADES holds that isn't CRITICAL, so
// CRITICAL ∪ WATCH === AT_RISK_GRADES by construction. C+ stays NORMAL.
// A student's own status (Staff/Admin) is decided by gpaRiskLevel() below,
// not by this.
export function riskLevel(grade: Grade): RiskLevel {
  if (CRITICAL_GRADES.has(grade)) return 'CRITICAL';
  if (AT_RISK_GRADES.has(grade)) return 'WATCH';
  return 'NORMAL';
}

// Cumulative-GPA cut-offs for a student's academic status. The only place
// the numbers live; pending confirmation against the university's rules.
export const GPA_CRITICAL_BELOW = 1.5;
export const GPA_WATCH_BELOW = 1.75;

// null = no GPA yet (no counted grade), which is "no data", not a band.
export function gpaRiskLevel(gpa: number | null): RiskLevel | null {
  if (gpa === null) return null;
  if (gpa < GPA_CRITICAL_BELOW) return 'CRITICAL';
  if (gpa < GPA_WATCH_BELOW) return 'WATCH';
  return 'NORMAL';
}

export const GRADE_STATUS: Record<Grade, 'PASS' | 'FAIL' | 'EXCLUDED'> = {
  A: 'PASS',
  B_PLUS: 'PASS',
  B: 'PASS',
  C_PLUS: 'PASS',
  C: 'PASS',
  D_PLUS: 'PASS',
  D: 'PASS',
  S: 'PASS',
  F: 'FAIL',
  U: 'FAIL',
  W: 'EXCLUDED',
  I: 'EXCLUDED',
};

// Grade -> 0-100 mastery score, shared by PLO achievement and career fit.
// FAIL (F or U) -> 0: a definite negative outcome that must drag the
// average down. Otherwise grade point / 4.0 * 100. S, W and I have no
// quantifiable outcome -> null (excluded, never counted as 0).
export function gradeToScore(grade: Grade): number | null {
  if (GRADE_STATUS[grade] === 'FAIL') return 0;
  const gradePoint = GRADE_POINTS[grade];
  return gradePoint === null ? null : (gradePoint / 4.0) * 100;
}
