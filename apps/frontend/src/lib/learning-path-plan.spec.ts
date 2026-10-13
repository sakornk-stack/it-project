import { graduationBlockerText, planCoversGraduation } from './learning-path-plan';

const course = (courseId: string, credits: number, categoryId: string) => ({
  courseId,
  credits,
  categoryId,
});

describe('planCoversGraduation', () => {
  it('is covered when the plan fills every remaining credit and category gap', () => {
    expect(
      planCoversGraduation({
        planCourses: [course('a', 6, 'elec')],
        creditsRemaining: 6,
        missingRequiredCourseIds: [],
        incompleteCategories: [{ categoryId: 'elec', creditsShort: 6 }],
      }),
    ).toBe('covered');
  });

  it('is not covered when credits remain beyond the plan', () => {
    expect(
      planCoversGraduation({
        planCourses: [course('a', 3, 'elec')],
        creditsRemaining: 6,
        missingRequiredCourseIds: [],
        incompleteCategories: [{ categoryId: 'elec', creditsShort: 6 }],
      }),
    ).toBe('not-covered');
  });

  it('is not covered when a required course is left out of the plan', () => {
    expect(
      planCoversGraduation({
        planCourses: [course('a', 6, 'elec')],
        creditsRemaining: 6,
        missingRequiredCourseIds: ['r1'],
        incompleteCategories: [],
      }),
    ).toBe('not-covered');
  });

  it('is not covered when only the elective category is short (credits from another category)', () => {
    expect(
      planCoversGraduation({
        planCourses: [course('a', 6, 'other')],
        creditsRemaining: 6,
        missingRequiredCourseIds: [],
        incompleteCategories: [{ categoryId: 'elec', creditsShort: 6 }],
      }),
    ).toBe('not-covered');
  });

  it('is unknown without a remaining-credit figure', () => {
    expect(
      planCoversGraduation({
        planCourses: [course('a', 6, 'elec')],
        creditsRemaining: null,
        missingRequiredCourseIds: [],
        incompleteCategories: [],
      }),
    ).toBe('unknown');
  });
});

describe('graduationBlockerText', () => {
  const base = {
    isReady: false,
    creditsMet: true,
    allCategoriesMet: true,
    missingRequiredCount: 0,
  };

  it('explains a category shortfall', () => {
    expect(graduationBlockerText({ ...base, allCategoriesMet: false })).toMatch(/หมวดเลือก/);
  });
  it('explains a total-credit shortfall', () => {
    expect(graduationBlockerText({ ...base, creditsMet: false })).toMatch(/หน่วยกิตรวม/);
  });
  it('has nothing to say when ready or when required courses are missing', () => {
    expect(graduationBlockerText({ ...base, isReady: true })).toBeNull();
    expect(graduationBlockerText({ ...base, missingRequiredCount: 2 })).toBeNull();
  });
});
