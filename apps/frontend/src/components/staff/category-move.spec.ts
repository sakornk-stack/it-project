import type {
  CourseCategory,
  CourseListItem,
  CurriculumRequirement,
} from '@eduanalyze-ai/shared-types';
import { categoryMoveImpact, categoryMoveMessages } from './category-move';

const course = (
  id: string,
  categoryId: string,
  credits: number,
  isActive = true,
): CourseListItem => ({
  id,
  code: id,
  name: id,
  nameEn: null,
  credits,
  isRequired: true,
  isActive,
  curriculumId: 'C1',
  categoryId,
});
const category = (id: string, name: string) => ({ id, name, curriculumId: 'C1' }) as CourseCategory;
const requirement = (categoryId: string, minCredits: number) =>
  ({ id: `r-${categoryId}`, categoryId, minCredits, curriculumId: 'C1' }) as CurriculumRequirement;

const CATEGORIES = [category('A', 'ศึกษาทั่วไป'), category('B', 'วิชาเฉพาะ')];
const COURSES = [
  course('x', 'A', 3),
  course('y', 'A', 3),
  course('gone', 'A', 3, false),
  course('z', 'B', 6),
];

describe('categoryMoveImpact', () => {
  it('is null when the category does not change', () => {
    expect(
      categoryMoveImpact(COURSES[0], { categoryId: 'A', credits: 3 }, COURSES, CATEGORIES, []),
    ).toBeNull();
  });

  it('counts active courses only and moves this course across', () => {
    const impact = categoryMoveImpact(
      COURSES[0],
      { categoryId: 'B', credits: 3 },
      COURSES,
      CATEGORIES,
      [requirement('A', 6), requirement('B', 6)],
    );
    expect(impact).toEqual({
      from: { name: 'ศึกษาทั่วไป', before: 6, after: 3, minCredits: 6 },
      to: { name: 'วิชาเฉพาะ', before: 6, after: 9, minCredits: 6 },
    });
  });

  it('uses the edited credits on the destination side', () => {
    const impact = categoryMoveImpact(
      COURSES[0],
      { categoryId: 'B', credits: 4 },
      COURSES,
      CATEGORIES,
      [],
    );
    expect(impact?.to.after).toBe(10);
    expect(impact?.to.minCredits).toBeNull();
  });

  it('is null for an unknown category', () => {
    expect(
      categoryMoveImpact(COURSES[0], { categoryId: 'Q', credits: 3 }, COURSES, CATEGORIES, []),
    ).toBeNull();
  });
});

describe('categoryMoveMessages', () => {
  it('warns when the source falls below its minimum', () => {
    const { warning, info } = categoryMoveMessages({
      from: { name: 'ศึกษาทั่วไป', before: 6, after: 3, minCredits: 6 },
      to: { name: 'วิชาเฉพาะ', before: 6, after: 9, minCredits: 6 },
    });
    expect(warning).toContain('ต่ำกว่าเกณฑ์ขั้นต่ำ 6 หน่วยกิต');
    expect(info).toContain('จะมีรายวิชารวม 9 หน่วยกิต (เดิม 6) เกณฑ์ขั้นต่ำ 6 หน่วยกิต');
  });

  it('gives no warning when the source still meets its minimum, and notes a missing requirement', () => {
    const { warning, info } = categoryMoveMessages({
      from: { name: 'ศึกษาทั่วไป', before: 9, after: 6, minCredits: 6 },
      to: { name: 'วิชาเฉพาะ', before: 0, after: 3, minCredits: null },
    });
    expect(warning).toBeNull();
    expect(info).toContain('ยังไม่ได้กำหนดเกณฑ์หน่วยกิต');
  });
});
