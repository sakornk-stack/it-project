import { parseSessionAbsoluteMaxHours } from './configuration';

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
