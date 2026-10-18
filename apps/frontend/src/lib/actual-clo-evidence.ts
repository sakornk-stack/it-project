import type { AchievementResult } from '@eduanalyze-ai/shared-types';

// A per-student CLO result built from entered assessment scores. The backend
// answers NO_EVIDENCE (score null) when nothing was entered, and that is "no
// data", not 0%, so the UI hides it instead of drawing an empty row.
export function hasActualCloEvidence(
  result: Pick<AchievementResult, 'source' | 'score'> | undefined,
): boolean {
  return (
    !!result &&
    result.source !== 'NO_EVIDENCE' &&
    result.score !== null &&
    Number.isFinite(Number.parseFloat(result.score))
  );
}
