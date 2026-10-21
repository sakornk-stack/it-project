import { comparePloCode, sortByPloCode } from './plo-order';

const codes = (items: { code: string }[]) => items.map((i) => i.code);
const of = (...list: string[]) => list.map((code) => ({ code }));

describe('sortByPloCode', () => {
  it('orders PLO1 to PLO12 by number, not as text (PLO2 before PLO10)', () => {
    const shuffled = of(
      'PLO10',
      'PLO2',
      'PLO12',
      'PLO1',
      'PLO11',
      'PLO9',
      'PLO3',
      'PLO5',
      'PLO4',
      'PLO8',
      'PLO7',
      'PLO6',
    );
    expect(codes(sortByPloCode(shuffled))).toEqual([
      'PLO1',
      'PLO2',
      'PLO3',
      'PLO4',
      'PLO5',
      'PLO6',
      'PLO7',
      'PLO8',
      'PLO9',
      'PLO10',
      'PLO11',
      'PLO12',
    ]);
  });

  it('fixes the reported case: PLO5 arriving first', () => {
    expect(codes(sortByPloCode(of('PLO5', 'PLO1', 'PLO2', 'PLO3', 'PLO4', 'PLO6')))).toEqual([
      'PLO1',
      'PLO2',
      'PLO3',
      'PLO4',
      'PLO5',
      'PLO6',
    ]);
  });

  it('gives the same result whatever order the rows arrive in', () => {
    const base = ['PLO3', 'PLO1', 'PLO10', 'PLO2', 'X-1', 'plo4', 'Extra'];
    const expected = codes(sortByPloCode(of(...base)));
    for (const rotate of [1, 2, 3, 4, 5, 6]) {
      const rotated = [...base.slice(rotate), ...base.slice(0, rotate)];
      expect(codes(sortByPloCode(of(...rotated)))).toEqual(expected);
    }
    expect(codes(sortByPloCode(of(...[...base].reverse())))).toEqual(expected);
  });

  it('puts codes that are not PLOn after the PLOn ones, in natural order, without throwing', () => {
    expect(codes(sortByPloCode(of('K2', 'PLO2', 'K10', 'PLO1', 'A', '')))).toEqual([
      'PLO1',
      'PLO2',
      '',
      'A',
      'K2',
      'K10',
    ]);
  });

  it('is stable for equal codes and leaves the input array alone', () => {
    const input = [
      { code: 'PLO2', id: 'a' },
      { code: 'PLO1', id: 'b' },
      { code: 'PLO2', id: 'c' },
    ];
    expect(sortByPloCode(input).map((i) => i.id)).toEqual(['b', 'a', 'c']);
    expect(input.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps radar points as they are, only reordered (no value is touched)', () => {
    const radar = [
      { code: 'PLO5', value: 1.5 },
      { code: 'PLO1', value: null },
      { code: 'PLO2', value: 100 },
    ];
    expect(sortByPloCode(radar)).toEqual([
      { code: 'PLO1', value: null },
      { code: 'PLO2', value: 100 },
      { code: 'PLO5', value: 1.5 },
    ]);
  });
});

describe('comparePloCode', () => {
  it('is negative, zero and positive in the right places', () => {
    expect(comparePloCode('PLO1', 'PLO2')).toBeLessThan(0);
    expect(comparePloCode('PLO10', 'PLO2')).toBeGreaterThan(0);
    expect(comparePloCode('PLO3', 'PLO3')).toBe(0);
  });
});
