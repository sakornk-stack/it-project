// The only place the career-fit thresholds live; adjust here.
export const CAREER_FIT_HIGH_MIN = 75;
export const CAREER_FIT_MEDIUM_MIN = 62.5;
// A career with fewer graded courses than this gets no score and no rank.
export const CAREER_FIT_MIN_GRADED_COURSES = 3;
export const CAREER_FIT_TOP_COURSES = 3;
export const CAREER_FIT_RECOMMENDED_COURSES = 3;

export type CareerFitLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export function careerFitLevel(score: number): CareerFitLevel {
  if (score >= CAREER_FIT_HIGH_MIN) return 'HIGH';
  if (score >= CAREER_FIT_MEDIUM_MIN) return 'MEDIUM';
  return 'LOW';
}
