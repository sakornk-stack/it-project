import { describeHeadcount } from './headcount';

describe('describeHeadcount', () => {
  it('says people first and explains the seats when some people take several courses', () => {
    expect(describeHeadcount(2, 5)).toEqual({
      value: 2,
      unit: 'คน',
      note: 'การลงทะเบียน 5 รายการ เพราะบางคนเรียนหลายวิชา',
    });
  });

  it('adds no note when every person has one seat', () => {
    expect(describeHeadcount(3, 3)).toEqual({ value: 3, unit: 'คน', note: null });
  });

  it('falls back to seats only when the people count is not available', () => {
    expect(describeHeadcount(null, 5)).toEqual({ value: 5, unit: 'รายการ', note: null });
    expect(describeHeadcount(Number.NaN, 5)).toEqual({ value: 5, unit: 'รายการ', note: null });
  });

  it('handles nobody enrolled and never prints NaN', () => {
    expect(describeHeadcount(0, 0)).toEqual({ value: 0, unit: 'คน', note: null });
    const h = describeHeadcount(null, Number.NaN);
    expect(h).toEqual({ value: 0, unit: 'รายการ', note: null });
  });
});
