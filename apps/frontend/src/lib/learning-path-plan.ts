// The saved plan can go stale (a course got passed, or a prerequisite
// changed since saving), so only ids that are still plannable are kept;
// with nothing saved the recommendation is used.
export function resolveInitialPlan(
  savedIds: string[] | null,
  availableIds: string[],
  recommendedIds: string[],
): { planIds: string[]; droppedCount: number } {
  if (savedIds === null) return { planIds: recommendedIds, droppedCount: 0 };
  const available = new Set(availableIds);
  const planIds = savedIds.filter((id) => available.has(id));
  return { planIds, droppedCount: savedIds.length - planIds.length };
}

export function isPlanDirty(baselineIds: string[], currentIds: string[]): boolean {
  return (
    baselineIds.length !== currentIds.length || baselineIds.some((id, i) => id !== currentIds[i])
  );
}

export const UNSAVED_PLAN_RESET_CONFIRM_MESSAGE =
  'แผนที่แก้ไขไว้ยังไม่ได้บันทึก การรีเซ็ตจะลบแผนที่บันทึกไว้และกลับไปใช้แผนที่แนะนำ ต้องการดำเนินการต่อหรือไม่?';

// "Does this plan finish the degree?" — used to soften the under-minimum credit
// warning in the final semester. 'unknown' (no remaining-credit figure) must never
// be treated as covered.
export type PlanCoverage = 'covered' | 'not-covered' | 'unknown';

export function planCoversGraduation({
  planCourses,
  creditsRemaining,
  missingRequiredCourseIds,
  incompleteCategories,
}: {
  planCourses: { courseId: string; credits: number; categoryId: string }[];
  creditsRemaining: number | null;
  missingRequiredCourseIds: string[];
  incompleteCategories: { categoryId: string; creditsShort: number }[];
}): PlanCoverage {
  if (creditsRemaining === null) return 'unknown';
  const planIds = new Set(planCourses.map((c) => c.courseId));
  const planCredits = planCourses.reduce((sum, c) => sum + c.credits, 0);
  if (planCredits < creditsRemaining) return 'not-covered';
  if (missingRequiredCourseIds.some((id) => !planIds.has(id))) return 'not-covered';
  const creditsIn = (categoryId: string) =>
    planCourses.filter((c) => c.categoryId === categoryId).reduce((s, c) => s + c.credits, 0);
  if (incompleteCategories.some((c) => creditsIn(c.categoryId) < c.creditsShort)) {
    return 'not-covered';
  }
  return 'covered';
}

// Why the student is not graduation-ready even though no required course is
// missing; null when there is nothing to explain.
export function graduationBlockerText(readiness: {
  isReady: boolean;
  creditsMet: boolean;
  allCategoriesMet: boolean;
  missingRequiredCount: number;
}): string | null {
  if (readiness.isReady || readiness.missingRequiredCount > 0) return null;
  if (!readiness.allCategoriesMet) {
    return 'วิชาบังคับครบแล้ว แต่ยังขาดหน่วยกิตในหมวดเลือก';
  }
  if (!readiness.creditsMet) return 'วิชาบังคับครบแล้ว แต่หน่วยกิตรวมยังไม่ครบตามหลักสูตร';
  return 'วิชาบังคับครบแล้ว แต่ยังไม่ครบเงื่อนไขอื่นของหลักสูตร';
}
