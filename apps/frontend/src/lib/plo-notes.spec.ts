import type { StudentPloCloBreakdownEntry } from '@eduanalyze-ai/shared-types';
import { isTqfCurriculum, ploCoverage } from './plo-notes';

function clo(courseId: string, score: number | null): StudentPloCloBreakdownEntry {
  return { cloId: `${courseId}-${score}`, courseId, score } as StudentPloCloBreakdownEntry;
}

describe('ploCoverage', () => {
  it('counts distinct courses, and those with a score', () => {
    expect(ploCoverage({ cloBreakdown: [clo('a', 50), clo('a', 70), clo('b', null)] })).toEqual({
      used: 1,
      total: 2,
    });
  });

  it('is 0 of 0 when the PLO has no CLO', () => {
    expect(ploCoverage({ cloBreakdown: [] })).toEqual({ used: 0, total: 0 });
  });
});

describe('isTqfCurriculum', () => {
  it('flags only the 2564 curriculum', () => {
    expect(isTqfCurriculum({ version: '2564', effectiveYear: 2564 })).toBe(true);
    expect(isTqfCurriculum({ version: '2569', effectiveYear: 2569 })).toBe(false);
  });
});
