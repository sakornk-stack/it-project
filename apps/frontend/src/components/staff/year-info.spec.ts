import type { StaffYearLevelsReport } from '@eduanalyze-ai/shared-types';
import { describeEmptyYears, yearInfoFrom, yearLevelTitle } from './year-info';

const entry = (id: string, onTrackStatus: 'on_track' | 'behind' | null) => ({
  studentProfileId: id,
  studentCode: id,
  fullName: id,
  admissionYear: 2565,
  onTrackStatus,
  gpa: 3,
  riskLevel: 'NORMAL' as const,
  lowGradeCount: 0,
});

describe('yearInfoFrom', () => {
  const report: StaffYearLevelsReport = {
    currentAcademicYear: 2567,
    buckets: [
      { yearLevel: 1, label: 'ปี 1', students: [entry('a', 'on_track'), entry('b', 'behind')] },
      { yearLevel: 4, label: 'ปี 4 ขึ้นไป', students: [entry('c', null)] },
    ],
  };

  it('maps each student to a year and collects the ones behind plan', () => {
    const info = yearInfoFrom(report);
    expect(info.levelById.get('b')).toBe(1);
    expect(info.levelById.get('c')).toBe(4);
    expect([...info.behindIds]).toEqual(['b']);
    expect(info.labelByLevel.get(4)).toBe('ปี 4 ขึ้นไป');
  });

  it('is empty before the report has loaded', () => {
    expect(yearInfoFrom(undefined).levelById.size).toBe(0);
  });
});

describe('yearLevelTitle', () => {
  it('marks the last band as 4 and above', () => {
    expect(yearLevelTitle(2)).toBe('ชั้นปีที่ 2');
    expect(yearLevelTitle(4)).toBe('ชั้นปีที่ 4 ขึ้นไป');
  });
});

describe('describeEmptyYears', () => {
  it('joins neighbouring empty years into one range', () => {
    expect(describeEmptyYears([1, 2, 3])).toBe('ชั้นปี 1–3: ไม่มีนิสิต');
  });

  it('names a single empty year', () => {
    expect(describeEmptyYears([2])).toBe('ชั้นปี 2: ไม่มีนิสิต');
  });

  it('keeps separate runs apart and marks the last year as "and above"', () => {
    expect(describeEmptyYears([1, 3, 4])).toBe('ชั้นปี 1, 3–4 ขึ้นไป: ไม่มีนิสิต');
    expect(describeEmptyYears([4])).toBe('ชั้นปี 4 ขึ้นไป: ไม่มีนิสิต');
  });

  it('has nothing to say when no year is empty', () => {
    expect(describeEmptyYears([])).toBeNull();
  });
});
