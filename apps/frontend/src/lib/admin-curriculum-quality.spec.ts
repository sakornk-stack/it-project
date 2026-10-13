import type {
  CohortPloAchievementReport,
  LowestCloEntry,
  RadarPoint,
} from '@eduanalyze-ai/shared-types';
import {
  CLOSE_SCORES_NOTE,
  formatGpa,
  formatPloScore,
  gpaBarPercent,
  gpaStatus,
  hasAnyPloData,
  hasLittleData,
  lowestPlos,
  ploScoresAreClose,
  sortCohorts,
  summarizeLowestClos,
} from './admin-curriculum-quality';

const plo = (code: string, value: number | null): RadarPoint => ({
  ploId: code,
  code,
  name: code,
  value,
});

describe('lowestPlos', () => {
  it('returns the lowest three, lowest first', () => {
    const radar = [
      plo('PLO1', 82),
      plo('PLO2', 70),
      plo('PLO3', 61),
      plo('PLO4', 86),
      plo('PLO5', 64),
    ];
    expect(lowestPlos(radar).map((p) => p.code)).toEqual(['PLO3', 'PLO5', 'PLO2']);
  });
  it('leaves out a PLO with no data instead of ranking it lowest', () => {
    expect(lowestPlos([plo('PLO1', null), plo('PLO2', 50)]).map((p) => p.code)).toEqual(['PLO2']);
  });
  it('keeps a measured zero', () => {
    expect(lowestPlos([plo('PLO1', 0), plo('PLO2', 50)])[0].code).toBe('PLO1');
  });
  it('breaks ties on code', () => {
    expect(lowestPlos([plo('PLO2', 50), plo('PLO1', 50)]).map((p) => p.code)).toEqual([
      'PLO1',
      'PLO2',
    ]);
  });
  it('does not change the array it is given', () => {
    const radar = [plo('PLO2', 50), plo('PLO1', 10)];
    lowestPlos(radar);
    expect(radar.map((p) => p.code)).toEqual(['PLO2', 'PLO1']);
  });
});

describe('summarizeLowestClos', () => {
  const clo = (code: string): LowestCloEntry => ({
    cloId: code,
    code,
    description: '',
    courseId: 'c',
    courseCode: 'C',
    courseName: 'C',
    achievementPercent: 40,
  });
  it('shows three and counts the rest of the tie', () => {
    const result = summarizeLowestClos(['D', 'A', 'C', 'B', 'E'].map(clo));
    expect(result.shown.map((c) => c.code)).toEqual(['A', 'B', 'C']);
    expect(result.hiddenCount).toBe(2);
  });
  it('has nothing hidden for a short list or none', () => {
    expect(summarizeLowestClos([clo('A')]).hiddenCount).toBe(0);
    expect(summarizeLowestClos([])).toEqual({ shown: [], hiddenCount: 0 });
  });
});

describe('hasLittleData', () => {
  it('is true below 5 people with a GPA, false from 5', () => {
    expect(hasLittleData(0)).toBe(true);
    expect(hasLittleData(4)).toBe(true);
    expect(hasLittleData(5)).toBe(false);
  });
  it('treats a bad number as little data', () => {
    expect(hasLittleData(Number.NaN)).toBe(true);
  });
});

describe('gpaBarPercent', () => {
  it('scales to 4.00 and clamps', () => {
    expect(gpaBarPercent(2)).toBe(50);
    expect(gpaBarPercent(5)).toBe(100);
    expect(gpaBarPercent(null)).toBe(0);
  });
});

describe('sortCohorts', () => {
  it('orders newest intake first without mutating', () => {
    const cohort = (admissionYear: number) => ({ admissionYear }) as CohortPloAchievementReport;
    const input = [cohort(2567), cohort(2565)];
    expect(sortCohorts(input).map((c) => c.admissionYear)).toEqual([2567, 2565]);
    expect(input[0].admissionYear).toBe(2567);
  });
});

describe('hasAnyPloData', () => {
  it('needs at least one measured PLO', () => {
    expect(hasAnyPloData([plo('A', null)])).toBe(false);
    expect(hasAnyPloData([plo('A', null), plo('B', 0)])).toBe(true);
    expect(hasAnyPloData([])).toBe(false);
  });
});

describe('formatGpa', () => {
  it('always has two decimals', () => {
    expect(formatGpa(2.5)).toBe('2.50');
    expect(formatGpa(3)).toBe('3.00');
    expect(formatGpa(2.345)).toBe('2.35');
  });
  it('shows the no-data label for null, never 0.00', () => {
    expect(formatGpa(null)).toBe('—');
    expect(formatGpa(null, 'ยังไม่มีข้อมูล')).toBe('ยังไม่มีข้อมูล');
  });
});

describe('formatPloScore', () => {
  it('writes the five-point score with two decimals', () => {
    expect(formatPloScore(60)).toBe('3.00');
    expect(formatPloScore(61.2)).toBe('3.06');
    expect(formatPloScore(0)).toBe('0.00');
    expect(formatPloScore(null)).toBe('—');
  });
});

describe('ranking uses the raw value, not the rounded text', () => {
  it('orders two PLOs that print the same', () => {
    // 60.21 and 60.24 percent both print 3.01 on the five-point scale
    const radar = [plo('PLO1', 60.24), plo('PLO2', 60.21)];
    expect(formatPloScore(60.24)).toBe(formatPloScore(60.21));
    expect(lowestPlos(radar).map((p) => p.code)).toEqual(['PLO2', 'PLO1']);
  });
});

describe('ploScoresAreClose', () => {
  it('is true when the listed scores differ by less than 0.05 points', () => {
    expect(ploScoresAreClose([plo('A', 60), plo('B', 60.5), plo('C', 60.9)])).toBe(true);
  });
  it('is false at 0.05 points or more', () => {
    expect(ploScoresAreClose([plo('A', 60), plo('B', 61)])).toBe(false); // exactly 0.05
    expect(ploScoresAreClose([plo('A', 50), plo('B', 70)])).toBe(false);
  });
  it('needs at least two measured scores', () => {
    expect(ploScoresAreClose([plo('A', 60)])).toBe(false);
    expect(ploScoresAreClose([plo('A', 60), plo('B', null)])).toBe(false);
    expect(ploScoresAreClose([])).toBe(false);
  });
  it('has the note text the page shows', () => {
    expect(CLOSE_SCORES_NOTE).toContain('ใกล้เคียงกัน');
  });
});

describe('gpaStatus', () => {
  it('names the band with a tone and a word', () => {
    expect(gpaStatus(1.49)).toEqual({ tone: 'danger', label: 'ต่ำกว่าเกณฑ์' });
    expect(gpaStatus(1.5)).toEqual({ tone: 'warning', label: 'เฝ้าระวัง' });
    expect(gpaStatus(1.74)).toEqual({ tone: 'warning', label: 'เฝ้าระวัง' });
    expect(gpaStatus(1.75)).toEqual({ tone: 'success', label: 'ตามเกณฑ์' });
  });

  it('gives no verdict when nobody has a GPA', () => {
    expect(gpaStatus(null)).toBeNull();
  });
});
