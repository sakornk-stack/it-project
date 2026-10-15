import { parseSessionAbsoluteMaxHours, parseTrustProxyHops } from './configuration';

describe('parseTrustProxyHops', () => {
  it('accepts non-negative whole numbers', () => {
    expect(parseTrustProxyHops('0')).toBe(0);
    expect(parseTrustProxyHops('1')).toBe(1);
    expect(parseTrustProxyHops(' 2 ')).toBe(2);
  });

  it.each([undefined, '', 'abc', '-1', '1.5', 'true', '1,2', '99999999999999999999'])(
    'trusts no proxy (0) for %p',
    (raw) => {
      expect(parseTrustProxyHops(raw)).toBe(0);
    },
  );
});

describe('parseSessionAbsoluteMaxHours', () => {
  it('uses a valid positive value', () => {
    expect(parseSessionAbsoluteMaxHours('4')).toBe(4);
    expect(parseSessionAbsoluteMaxHours('0.5')).toBe(0.5);
  });

  it.each([undefined, '', 'abc', '0', '-3', 'NaN', 'Infinity'])(
    'falls back to the default 8 for %p',
    (raw) => {
      expect(parseSessionAbsoluteMaxHours(raw)).toBe(8);
    },
  );
});
