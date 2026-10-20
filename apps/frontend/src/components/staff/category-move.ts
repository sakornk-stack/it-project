import type {
  CourseCategory,
  CourseListItem,
  CurriculumRequirement,
} from '@eduanalyze-ai/shared-types';

// What moving a course to another category (or changing its credits) does to
// the credit totals of the two categories, measured against each category's
// minCredits requirement. Only a warning: the move itself is never blocked,
// because the requirement may be the one that needs fixing.

export interface CategoryCredits {
  name: string;
  before: number;
  after: number;
  minCredits: number | null;
}

export interface CategoryMoveImpact {
  from: CategoryCredits;
  to: CategoryCredits;
}

function creditsIn(categoryId: string, courses: CourseListItem[]): number {
  return courses
    .filter((c) => c.categoryId === categoryId && c.isActive)
    .reduce((sum, c) => sum + c.credits, 0);
}

// null when the category is unchanged or either side is unknown.
export function categoryMoveImpact(
  course: Pick<CourseListItem, 'id' | 'categoryId' | 'credits'>,
  next: { categoryId: string; credits: number },
  courses: CourseListItem[],
  categories: CourseCategory[],
  requirements: CurriculumRequirement[],
): CategoryMoveImpact | null {
  if (!next.categoryId || next.categoryId === course.categoryId) return null;
  const fromCategory = categories.find((c) => c.id === course.categoryId);
  const toCategory = categories.find((c) => c.id === next.categoryId);
  if (!fromCategory || !toCategory) return null;
  const others = courses.filter((c) => c.id !== course.id);
  const minOf = (categoryId: string) =>
    requirements.find((r) => r.categoryId === categoryId)?.minCredits ?? null;
  const credits = Number.isFinite(next.credits) ? next.credits : course.credits;
  const fromAfter = creditsIn(fromCategory.id, others);
  const toBefore = creditsIn(toCategory.id, others);
  return {
    from: {
      name: fromCategory.name,
      before: fromAfter + course.credits,
      after: fromAfter,
      minCredits: minOf(fromCategory.id),
    },
    to: {
      name: toCategory.name,
      before: toBefore,
      after: toBefore + credits,
      minCredits: minOf(toCategory.id),
    },
  };
}

export function categoryMoveMessages(impact: CategoryMoveImpact): {
  warning: string | null;
  info: string;
} {
  const { from, to } = impact;
  const warning =
    from.minCredits !== null && from.after < from.minCredits
      ? `หมวด "${from.name}" จะเหลือ ${from.after} หน่วยกิต (เดิม ${from.before}) ต่ำกว่าเกณฑ์ขั้นต่ำ ${from.minCredits} หน่วยกิต ตรวจสอบเกณฑ์ของหมวดหลังย้าย`
      : null;
  const target =
    to.minCredits === null
      ? 'หมวดนี้ยังไม่ได้กำหนดเกณฑ์หน่วยกิต'
      : `เกณฑ์ขั้นต่ำ ${to.minCredits} หน่วยกิต`;
  return {
    warning,
    info: `หมวด "${to.name}" จะมีรายวิชารวม ${to.after} หน่วยกิต (เดิม ${to.before}) ${target}`,
  };
}
