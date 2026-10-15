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

// Bar colour of a grade in a distribution: one continuous ramp that follows the
// badge tones above (success -> warning -> danger), darkest at the top grade and
// lightening toward the middle, then deepening again toward F. No grade is drawn
// grey, so a mid grade never looks disabled. Other grades are not drawn as bars.
const GRADE_BAR_CLASS: Partial<Record<Grade, string>> = {
  A: 'bg-emerald-600',
  B_PLUS: 'bg-emerald-500',
  B: 'bg-emerald-400',
  C_PLUS: 'bg-amber-300',
  C: 'bg-amber-400',
  D_PLUS: 'bg-amber-500',
  D: 'bg-amber-600',
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
