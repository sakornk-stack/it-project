import type {
  CloDetail,
  CloPloMappingItem,
  CourseListItem,
  PloListItem,
} from '@eduanalyze-ai/shared-types';
import {
  chipLabel,
  cloCards,
  cloCountOfPlo,
  courseFlag,
  courseRows,
  filterCourseRows,
  ploChips,
  outcomeStats,
} from './outcomes-view';

const course = (
  id: string,
  code: string,
  name: string,
  curriculumId = 'cur-1',
): CourseListItem => ({
  id,
  code,
  name,
  nameEn: null,
  credits: 3,
  isRequired: true,
  isActive: true,
  curriculumId,
  categoryId: 'cat',
});
const clo = (id: string, courseId: string, code: string, isConfirmed = true): CloDetail => ({
  id,
  courseId,
  code,
  description: 'd',
  achievementThreshold: null,
  isConfirmed,
  isActive: true,
});

const courses = [
  course('c2', '02739112', 'วิชาสอง'),
  course('c1', '01418111', 'วิชาหนึ่ง'),
  course('x', '99999999', 'อีกหลักสูตร', 'cur-2'),
  course('c3', '03000000', 'วิชาไม่มี CLO'),
];
const clos = [
  clo('a', 'c1', 'CLO2'),
  clo('b', 'c1', 'CLO10', false),
  clo('c', 'c1', 'CLO1'),
  clo('d', 'c2', 'CLO1', false),
  clo('e', 'x', 'CLO1', false),
];

describe('courseRows', () => {
  const rows = courseRows(courses, clos, 'cur-1');

  it('lists only this curriculum, in code order, with CLO counts', () => {
    expect(rows.map((r) => [r.course.code, r.cloCount, r.unconfirmedCount])).toEqual([
      ['01418111', 3, 1],
      ['02739112', 1, 1],
      ['03000000', 0, 0],
    ]);
  });

  it('flags a course with no CLO, and one with unconfirmed CLOs', () => {
    expect(rows.map(courseFlag)).toEqual(['UNCONFIRMED', 'UNCONFIRMED', 'NO_CLO']);
    expect(courseFlag({ cloCount: 2, unconfirmedCount: 0 })).toBeNull();
  });

  it('searches code and name, and can keep only courses with unconfirmed CLOs', () => {
    expect(filterCourseRows(rows, '2739', false).map((r) => r.course.id)).toEqual(['c2']);
    expect(filterCourseRows(rows, 'สอง', false).map((r) => r.course.id)).toEqual(['c2']);
    expect(filterCourseRows(rows, '', true).map((r) => r.course.id)).toEqual(['c1', 'c2']);
  });
});

describe('cloCards', () => {
  it('shows only the selected course, in natural code order', () => {
    expect(cloCards(clos, 'c1', false).map((c) => c.code)).toEqual(['CLO1', 'CLO2', 'CLO10']);
  });
  it('can keep only unconfirmed CLOs', () => {
    expect(cloCards(clos, 'c1', true).map((c) => c.code)).toEqual(['CLO10']);
  });
});

describe('PLO chips', () => {
  const plos: PloListItem[] = [
    {
      id: 'p1',
      code: 'PLO1',
      name: 'a',
      description: null,
      curriculumId: 'cur-1',
    },
    {
      id: 'p2',
      code: 'PLO2',
      name: 'b',
      description: null,
      curriculumId: 'cur-1',
    },
  ];
  const mappings: CloPloMappingItem[] = [
    { id: 'm1', cloId: 'a', ploId: 'p2', weight: 3 },
    { id: 'm2', cloId: 'a', ploId: 'p1', weight: 5 },
    { id: 'm3', cloId: 'b', ploId: 'p1', weight: 1 },
    { id: 'm4', cloId: 'a', ploId: 'gone', weight: 2 },
  ];

  it('lists the PLOs one CLO answers with weights, in PLO order', () => {
    expect(ploChips('a', mappings, plos).map(chipLabel)).toEqual(['PLO1 ×5', 'PLO2 ×3']);
  });
  it('counts the CLOs that answer a PLO', () => {
    expect(cloCountOfPlo('p1', mappings)).toBe(2);
  });
});

describe('outcomeStats', () => {
  it('counts courses, courses with a CLO and unconfirmed CLOs', () => {
    expect(outcomeStats(courseRows(courses, clos, 'cur-1'))).toEqual({
      courses: 3,
      coursesWithClo: 2,
      unconfirmed: 2,
    });
  });
});
