import type { CareerFitEntry, CareerFitReport } from '@eduanalyze-ai/shared-types';
import {
  buildCareerFitGroups,
  buildCareerFitView,
  CAREER_GROUP_OTHER_NAME,
  CAREER_FIT_FEW_COURSES_TEXT,
  careerCoverageText,
  isFewCourseCareer,
  MAX_RANKED_CAREERS,
} from './career-fit';

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

  it('keeps analysable careers beyond the top 3 in `others`, not hidden', () => {
    const med = (id: string) => entry(id, { level: 'MEDIUM', score: 70 });
    const v = buildCareerFitView(
      report('OK', [entry('a'), entry('b'), entry('c'), med('d'), med('e'), med('f'), med('g')]),
    );
    expect(v.ranked.map((c) => c.careerId)).toEqual(['a', 'b', 'c']);
    expect(v.others.map((c) => c.careerId)).toEqual(['d', 'e', 'f', 'g']);
    expect(v.insufficient).toHaveLength(0);
    expect(v.analyzedCount).toBe(7);
    expect(v.totalCount).toBe(7);
  });

  it('mixes others and insufficient and counts only analysable ones', () => {
    const v = buildCareerFitView(
      report('OK', [
        entry('a'),
        entry('b'),
        entry('c'),
        entry('d'),
        insufficient('x'),
        insufficient('y'),
      ]),
    );
    expect(v.others.map((c) => c.careerId)).toEqual(['d']);
    expect(v.insufficient.map((c) => c.careerId)).toEqual(['x', 'y']);
    expect(v.analyzedCount).toBe(4);
    expect(v.totalCount).toBe(6);
  });

  it('has no others with fewer than 3 analysable careers', () => {
    const v = buildCareerFitView(report('OK', [entry('a'), entry('b'), insufficient('x')]));
    expect(v.ranked).toHaveLength(2);
    expect(v.others).toEqual([]);
    expect(v.analyzedCount).toBe(2);
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

describe('isFewCourseCareer', () => {
  it('is true only when the curriculum links fewer than 3 courses to the career', () => {
    expect(isFewCourseCareer({ totalCourseCount: 2 })).toBe(true);
    expect(isFewCourseCareer({ totalCourseCount: 3 })).toBe(false);
    expect(CAREER_FIT_FEW_COURSES_TEXT).toMatch(/วิชาในสายนี้น้อย/);
  });

  it('keeps a few-course career in the insufficient list', () => {
    const v = buildCareerFitView(
      report('OK', [
        entry('a'),
        entry('few', {
          status: 'INSUFFICIENT_DATA',
          score: null,
          level: null,
          totalCourseCount: 2,
        }),
      ]),
    );
    expect(v.insufficient.map((c) => c.careerId)).toEqual(['few']);
  });
});

describe('careerCoverageText', () => {
  it('states graded of total courses', () => {
    expect(careerCoverageText({ gradedCourseCount: 3, totalCourseCount: 5 })).toBe(
      'ใช้ข้อมูลจาก 3 จาก 5 วิชาของสายนี้',
    );
  });
});

const group = (id: string, sortOrder: number, description: string | null = null) => ({
  id,
  name: `กลุ่ม ${id}`,
  description,
  sortOrder,
});

describe('buildCareerFitGroups', () => {
  it('orders groups by their sortOrder, not by score, and puts ungrouped careers last', () => {
    const groups = buildCareerFitGroups([
      entry('hi', { group: group('g2', 2), score: 95 }),
      entry('free'),
      entry('lo', { group: group('g1', 1), score: 60, level: 'LOW' }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['g1', 'g2', 'other']);
    expect(groups[2]).toMatchObject({ name: CAREER_GROUP_OTHER_NAME, isOther: true });
  });

  it('takes the group level from its best analysable career (no averaging)', () => {
    const [g] = buildCareerFitGroups([
      entry('best', { group: group('g', 0), level: 'HIGH' }),
      entry('weak', { group: group('g', 0), level: 'LOW', score: 40 }),
      { ...insufficient('x'), group: group('g', 0) },
    ]);
    expect(g.level).toBe('HIGH');
    expect(g.analyzedCount).toBe(2);
    expect(g.careers.map((c) => c.careerId)).toEqual(['best', 'weak', 'x']);
  });

  it('has a null level when no career in the group is analysable', () => {
    const [g] = buildCareerFitGroups([
      entry('a', { group: group('g', 0), status: 'INSUFFICIENT_DATA', score: null, level: null }),
    ]);
    expect(g.level).toBeNull();
    expect(g.analyzedCount).toBe(0);
  });

  it('copes with an empty or missing group description', () => {
    const [a, b, c] = buildCareerFitGroups([
      entry('1', { group: group('g1', 1, '  ') }),
      entry('2', { group: group('g2', 2, null) }),
      entry('3', { group: group('g3', 3, 'มีข้อความ') }),
    ]);
    expect([a.description, b.description, c.description]).toEqual([null, null, 'มีข้อความ']);
  });

  it('does not change which careers are ranked (same top 3 as without groups)', () => {
    const careers = [
      entry('a', { group: group('g2', 2) }),
      entry('b', { group: group('g1', 1) }),
      entry('c'),
      entry('d', { group: group('g1', 1) }),
    ];
    const v = buildCareerFitView(report('OK', careers));
    expect(v.ranked.map((c) => c.careerId)).toEqual(['a', 'b', 'c']);
    expect(v.others.map((c) => c.careerId)).toEqual(['d']);
  });
});

describe('buildCareerFitView groups', () => {
  it('is not grouped when no career has a group (old data, nothing breaks)', () => {
    const v = buildCareerFitView(report('OK', [entry('a'), entry('b')]));
    expect(v.hasGroups).toBe(false);
  });

  it('is grouped as soon as one career has a group; the rest fall into "other"', () => {
    const v = buildCareerFitView(report('OK', [entry('a', { group: group('g', 0) }), entry('b')]));
    expect(v.hasGroups).toBe(true);
    expect(v.groups.map((g) => g.key)).toEqual(['g', 'other']);
  });

  it('has no groups for the empty states', () => {
    expect(buildCareerFitView(report('NO_GRADES', [])).groups).toEqual([]);
    expect(buildCareerFitView(report('NO_CAREERS', [])).hasGroups).toBe(false);
  });
});
