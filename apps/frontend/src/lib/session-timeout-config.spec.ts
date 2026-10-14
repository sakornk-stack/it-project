import { parseSessionTimeoutConfig } from './session-timeout-config';

describe('parseSessionTimeoutConfig', () => {
  it('defaults to 30 min idle, 60 s warning, 8 h cap', () => {
    expect(parseSessionTimeoutConfig({})).toEqual({
      idleMs: 30 * 60_000,
      warningMs: 60_000,
      maxSessionMs: 8 * 3_600_000,
    });
  });

  it('reads valid overrides', () => {
    expect(
      parseSessionTimeoutConfig({
        idleMinutes: '15',
        warningSeconds: '30',
        maxHours: '4',
      }),
    ).toEqual({
      idleMs: 15 * 60_000,
      warningMs: 30_000,
      maxSessionMs: 4 * 3_600_000,
    });
  });

  it.each(['', 'abc', '0', '-5', 'NaN'])('falls back to defaults for %p', (bad) => {
    expect(
      parseSessionTimeoutConfig({
        idleMinutes: bad,
        warningSeconds: bad,
        maxHours: bad,
      }),
    ).toEqual(parseSessionTimeoutConfig({}));
  });

  it('keeps the warning shorter than the idle timeout', () => {
    // 2 min idle with a 5 min warning would show the dialog immediately.
    const config = parseSessionTimeoutConfig({
      idleMinutes: '2',
      warningSeconds: '300',
    });
    expect(config.warningMs).toBeLessThan(config.idleMs);
    expect(config.warningMs).toBe(60_000);
  });

  it('halves the idle window when even the default warning would not fit', () => {
    const config = parseSessionTimeoutConfig({
      idleMinutes: '0.5',
      warningSeconds: '300',
    });
    expect(config.idleMs).toBe(30_000);
    expect(config.warningMs).toBe(15_000);
  });
});
