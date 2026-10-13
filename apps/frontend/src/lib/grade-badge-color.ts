import type { Grade } from '@eduanalyze-ai/shared-types';
import { BADGE_TONE_CLASSES, BAR_TONE_CLASSES, type SemanticTone } from '@/lib/tone';

// Mirrors the PASS/FAIL/EXCLUDED split already defined backend-side
// (grade-point.constant.ts's GRADE_STATUS) rather than inventing a new
// categorization — S is PASS (success, credit-earning even though it has
// no GPA effect) and U is FAIL (danger, same severity as F), W/I are
// EXCLUDED (neutral). A/B_PLUS/B vs C_PLUS-D further split PASS into
// "solid" vs "risky" for the badge, which GRADE_STATUS itself doesn't
// distinguish (both are just PASS there).
const GRADE_BADGE_TONE: Record<Grade, SemanticTone> = {
  A: 'success',
  B_PLUS: 'success',
  B: 'success',
  C_PLUS: 'warning',
  C: 'warning',
  D_PLUS: 'warning',
  D: 'warning',
  S: 'success',
  F: 'danger',
  U: 'danger',
  W: 'neutral',
  I: 'neutral',
};

// Bar colour of a grade in a distribution: the blues for A, B+ and B (strongest
// first), a neutral for C+ and C, amber for D+ and D, red for F. Other grades
// are not drawn as bars.
const GRADE_BAR_CLASS: Partial<Record<Grade, string>> = {
  A: 'bg-blue-900',
  B_PLUS: 'bg-blue-700',
  B: 'bg-blue-500',
  C_PLUS: 'bg-slate-500',
  C: 'bg-slate-400',
  D_PLUS: 'bg-amber-500',
  D: 'bg-amber-400',
  F: 'bg-red-500',
};

export function gradeBarClassName(grade: Grade): string {
  return GRADE_BAR_CLASS[grade] ?? BAR_TONE_CLASSES.neutral;
}

export function gradeBadgeTone(grade: Grade): SemanticTone {
  return GRADE_BADGE_TONE[grade];
}

export function gradeBadgeClassName(grade: Grade): string {
  return BADGE_TONE_CLASSES[gradeBadgeTone(grade)];
}
