import {
  expectedCreditsByNow,
  resolveOnTrackStatus,
  resolveYearLevel,
} from './year-level';

describe('resolveYearLevel', () => {
  it('clamps to 1..4', () => {
    expect(resolveYearLevel(2570, 2570)).toBe(1);
    expect(resolveYearLevel(2573, 2570)).toBe(4);
    expect(resolveYearLevel(2580, 2570)).toBe(4);
    expect(resolveYearLevel(2568, 2570)).toBe(1);
  });
});

describe('expectedCreditsByNow', () => {
  it('year 1 expects nothing, year 4 expects 75%', () => {
    expect(expectedCreditsByNow(132, 4, 2570, 2570)).toBe(0);
    expect(expectedCreditsByNow(132, 4, 2571, 2570)).toBe(33);
    expect(expectedCreditsByNow(132, 4, 2573, 2570)).toBe(99);
  });

  it('expects 100% once the nominal duration has passed (no 75% cap)', () => {
    expect(expectedCreditsByNow(132, 4, 2574, 2570)).toBe(132);
    expect(expectedCreditsByNow(132, 4, 2580, 2570)).toBe(132);
  });

  it('honours other totals and durations, rounding up', () => {
    expect(expectedCreditsByNow(120, 4, 2572, 2570)).toBe(60);
    expect(expectedCreditsByNow(150, 5, 2572, 2570)).toBe(60);
    expect(expectedCreditsByNow(132, 3, 2571, 2570)).toBe(44);
    expect(expectedCreditsByNow(100, 3, 2571, 2570)).toBe(34);
  });

  it('a future admission year expects 0', () => {
    expect(expectedCreditsByNow(132, 4, 2570, 2575)).toBe(0);
  });
});

describe('ICT 2564 (126 credits, 4 years)', () => {
  it('expects 95 credits after 3 elapsed years (was 99 at 132)', () => {
    expect(expectedCreditsByNow(126, 4, 2569, 2566)).toBe(95);
    expect(expectedCreditsByNow(132, 4, 2569, 2566)).toBe(99);
  });

  it('is behind at 94 and on track at 95 of the expected 95', () => {
    expect(resolveOnTrackStatus(94, 126, 95)).toBe('behind');
    expect(resolveOnTrackStatus(95, 126, 95)).toBe('on_track');
  });
});

describe('resolveOnTrackStatus', () => {
  it('behind only when strictly below expected', () => {
    expect(resolveOnTrackStatus(32, 132, 33)).toBe('behind');
    expect(resolveOnTrackStatus(33, 132, 33)).toBe('on_track');
    expect(resolveOnTrackStatus(0, 132, 0)).toBe('on_track');
  });

  it('no badge once the curriculum credits are complete', () => {
    expect(resolveOnTrackStatus(132, 132, 132)).toBeNull();
    expect(resolveOnTrackStatus(140, 132, 132)).toBeNull();
  });
});
