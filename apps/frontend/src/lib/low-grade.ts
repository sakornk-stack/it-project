import type { Grade } from '@eduanalyze-ai/shared-types';

// A fact about one course, not a status of the student: the latest result of a
// course is D+, D, F or U. C is not in it. No GPA is involved (the Instructor
// side is not given one), and Staff and Admin keep their own GPA-based status.
export const LOW_GRADES: ReadonlySet<Grade> = new Set<Grade>(['D_PLUS', 'D', 'F', 'U']);

export const isLowGrade = (grade: Grade): boolean => LOW_GRADES.has(grade);

export const LOW_GRADE_LABEL = 'มีเกรด D+ ลงไป';
export const LOW_GRADE_RULE = 'เกรดล่าสุดของวิชาเป็น D+, D, F หรือ U';
export const NO_LOW_GRADE = 'ยังไม่มีนิสิตที่มีเกรด D+ ลงไป';
