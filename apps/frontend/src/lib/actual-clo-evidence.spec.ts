import { hasActualCloEvidence } from './actual-clo-evidence';

describe('hasActualCloEvidence', () => {
  it('is false while the result is still loading', () => {
    expect(hasActualCloEvidence(undefined)).toBe(false);
  });

  it('is false when nothing was entered (NO_EVIDENCE, null score)', () => {
    expect(hasActualCloEvidence({ source: 'NO_EVIDENCE', score: null })).toBe(false);
  });

  it('is false for a NO_EVIDENCE result even if a score string is present', () => {
    expect(hasActualCloEvidence({ source: 'NO_EVIDENCE', score: '0' })).toBe(false);
  });

  it('is false for an evidence-based result without a usable score', () => {
    expect(hasActualCloEvidence({ source: 'EVIDENCE_BASED', score: null })).toBe(false);
    expect(hasActualCloEvidence({ source: 'EVIDENCE_BASED', score: 'abc' })).toBe(false);
  });

  it('is true for a real score, including 0', () => {
    expect(hasActualCloEvidence({ source: 'EVIDENCE_BASED', score: '72.5' })).toBe(true);
    expect(hasActualCloEvidence({ source: 'EVIDENCE_BASED', score: '0' })).toBe(true);
  });
});
