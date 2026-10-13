import type { CareerFitEntry, CareerFitReport } from '@eduanalyze-ai/shared-types';
import { buildCareerFitView, careerCoverageText, MAX_RANKED_CAREERS } from './career-fit';

const entry = (id: string, over: Partial<CareerFitEntry> = {}): CareerFitEntry => ({
  careerId: id,
  careerName: id,
  status: 'OK',
  score: 80,
  level: 'HIGH',
  coverage: 1,
  gradedCourseCount: 4,
  totalCourseCount: 4,
  topCourses: [],
  recommendedCourses: [],
  ...over,
});
const insufficient = (id: string) =>
  entry(id, { status: 'INSUFFICIENT_DATA', score: null, level: null });
const report = (status: CareerFitReport['status'], careers: CareerFitEntry[]): CareerFitReport => ({
  status,
  message: '',
  careers,
});

describe('buildCareerFitView', () => {
  it('keeps the top 3 ranked careers and lists insufficient ones separately', () => {
    const v = buildCareerFitView(
      report('OK', [entry('a'), entry('b'), entry('c'), entry('d'), insufficient('x')]),
    );
    expect(v.kind).toBe('ranked');
    expect(v.ranked.map((c) => c.careerId)).toEqual(['a', 'b', 'c']);
    expect(v.ranked).toHaveLength(MAX_RANKED_CAREERS);
    expect(v.insufficient.map((c) => c.careerId)).toEqual(['x']);
  });

  it('turns NO_GRADES and NO_CAREERS into a polite empty state, not an error', () => {
    expect(buildCareerFitView(report('NO_GRADES', [])).emptyText).toMatch(/ยังไม่มีผลการเรียน/);
    expect(buildCareerFitView(report('NO_CAREERS', [])).emptyText).toMatch(
      /ยังไม่มีข้อมูลสายอาชีพ/,
    );
  });

  it('handles all-insufficient: nothing ranked, all in the fold', () => {
    const v = buildCareerFitView(report('OK', [insufficient('x'), insufficient('y')]));
    expect(v.ranked).toEqual([]);
    expect(v.insufficient).toHaveLength(2);
  });
});

describe('careerCoverageText', () => {
  it('states graded of total courses', () => {
    expect(careerCoverageText({ gradedCourseCount: 3, totalCourseCount: 5 })).toBe(
      'ใช้ข้อมูลจาก 3 จาก 5 วิชาของสายนี้',
    );
  });
});
