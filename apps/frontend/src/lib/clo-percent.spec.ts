import { NO_CLO_DATA_LABEL, cloBarValue, formatCloPercent, hasCloPercent } from './clo-percent';

describe('clo-percent', () => {
  it('shows "ไม่มีข้อมูล" for null/undefined/NaN, never 0%', () => {
    expect(formatCloPercent(null)).toBe(NO_CLO_DATA_LABEL);
    expect(formatCloPercent(undefined)).toBe(NO_CLO_DATA_LABEL);
    expect(formatCloPercent(Number.NaN)).toBe(NO_CLO_DATA_LABEL);
  });

  it('shows a real 0 as 0%', () => {
    expect(formatCloPercent(0)).toBe('0%');
    expect(hasCloPercent(0)).toBe(true);
  });

  it('rounds measured values', () => {
    expect(formatCloPercent(66.6)).toBe('67%');
  });

  it('clamps the bar and empties it for no data', () => {
    expect(cloBarValue(null)).toBe(0);
    expect(cloBarValue(150)).toBe(100);
    expect(cloBarValue(42)).toBe(42);
  });
});
