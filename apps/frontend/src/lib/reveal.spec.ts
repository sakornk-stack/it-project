import { REVEAL_MAX_STAGGER_INDEX, REVEAL_STAGGER_MS, revealDelayMs } from './reveal';

describe('revealDelayMs', () => {
  it('staggers the first-screen blocks by index', () => {
    expect(revealDelayMs(0, true)).toBe(0);
    expect(revealDelayMs(1, true)).toBe(REVEAL_STAGGER_MS);
    expect(revealDelayMs(3, true)).toBe(3 * REVEAL_STAGGER_MS);
  });

  it('caps the delay so a late block on a long page never waits long', () => {
    const cap = REVEAL_MAX_STAGGER_INDEX * REVEAL_STAGGER_MS;
    expect(revealDelayMs(REVEAL_MAX_STAGGER_INDEX + 5, true)).toBe(cap);
  });

  it('plays a block reached by scrolling at once, whatever its index', () => {
    expect(revealDelayMs(4, false)).toBe(0);
  });

  it('treats a missing or invalid index as 0', () => {
    expect(revealDelayMs(Number.NaN, true)).toBe(0);
    expect(revealDelayMs(-2, true)).toBe(0);
  });
});
