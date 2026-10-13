import { formatPloScore } from './admin-curriculum-quality';
import { formatFiveScale, formatFiveScaleAgainstThreshold } from './five-scale';

// The PLO table writes the scale's top as formatValue(100), so each formatter must
// give the matching top for the precision it uses.
describe('five-point scale formatters', () => {
  it('formatFiveScale shows one decimal, so the top is 5.0', () => {
    expect(formatFiveScale(100)).toBe('5.0');
    expect(formatFiveScale(50)).toBe('2.5');
  });

  it('formatPloScore shows two decimals, so the top is 5.00', () => {
    expect(formatPloScore(100)).toBe('5.00');
  });

  it('both show the no-data label for null', () => {
    expect(formatFiveScale(null)).toBe('—');
    expect(formatPloScore(null, 'ไม่มีข้อมูล')).toBe('ไม่มีข้อมูล');
  });
});

describe('formatFiveScaleAgainstThreshold', () => {
  it('shows two decimals rounded down when just below the threshold would round equal', () => {
    expect(formatFiveScaleAgainstThreshold(69.4, 70, false)).toBe('3.47');
    expect(formatFiveScaleAgainstThreshold(69.99, 70, false)).toBe('3.49');
  });

  it('keeps one decimal when exactly at the threshold', () => {
    expect(formatFiveScaleAgainstThreshold(70, 70, true)).toBe('3.5');
  });

  it('keeps one decimal when above the threshold', () => {
    expect(formatFiveScaleAgainstThreshold(72.3, 70, true)).toBe('3.6');
  });

  it('keeps one decimal when clearly below the threshold', () => {
    expect(formatFiveScaleAgainstThreshold(60, 70, false)).toBe('3.0');
  });

  it('keeps one decimal when there is no threshold', () => {
    expect(formatFiveScaleAgainstThreshold(69.4, null, false)).toBe('3.5');
  });

  it('shows the no-data label for null', () => {
    expect(formatFiveScaleAgainstThreshold(null, 70, false)).toBe('—');
    expect(formatFiveScaleAgainstThreshold(null, null, false, 'ไม่มีข้อมูล')).toBe('ไม่มีข้อมูล');
  });
});
