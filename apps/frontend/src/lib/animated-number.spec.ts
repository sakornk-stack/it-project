import { COUNT_UP_MS, isCountable, numberText } from './animated-number';

describe('isCountable', () => {
  it('accepts only finite numbers', () => {
    expect(isCountable(0)).toBe(true);
    expect(isCountable(2.85)).toBe(true);
    expect(isCountable(null)).toBe(false);
    expect(isCountable(undefined)).toBe(false);
    expect(isCountable(Number.NaN)).toBe(false);
    expect(isCountable(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isCountable('–')).toBe(false);
    expect(isCountable('12')).toBe(false);
  });
});

describe('numberText', () => {
  const percent = (n: number) => `${Math.round(n)}%`;

  it('final text is the real value in the page format; shown follows the count', () => {
    expect(numberText(72.4, 31, percent, '—')).toEqual({ final: '72%', shown: '31%' });
  });

  it('is identical once the count has ended', () => {
    const text = numberText(72.4, 72.4, percent, '—');
    expect(text.shown).toBe(text.final);
  });

  it.each([null, undefined, Number.NaN])('shows the fallback for %s, never a count', (missing) => {
    expect(numberText(missing, 5, percent, '–')).toEqual({ final: '–', shown: '–' });
  });

  it('the count is short', () => {
    expect(COUNT_UP_MS).toBeLessThanOrEqual(800);
  });
});
