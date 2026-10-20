import type { CourseListItem } from '@eduanalyze-ai/shared-types';
import { STAFF_WRITE_ERRORS } from '@/lib/api-error-presets';
import { describeApiError } from '@/lib/describe-api-error';

// Texts and error mapping for the list of deactivated courses
// (GET /courses/inactive, POST /courses/:id/reactivate).

export function reactivateTitle(course: Pick<CourseListItem, 'code' | 'name'>): string {
  return `เปิดใช้งานรายวิชา ${course.code} ${course.name}?`;
}

export const REACTIVATE_NOTE =
  'รายวิชาจะกลับมาอยู่ในหมวดเดิมของหลักสูตร วิชาบังคับก่อนที่ถูกลบตอนปิดใช้งานจะไม่กลับมา ต้องเพิ่มใหม่หากยังใช้อยู่';

// A blocked reactivate is a 409 whose Thai message says why (already active,
// its category or curriculum is closed, or the code is taken), shown as is.
export function describeReactivateError(error: unknown): string {
  return describeApiError(error, STAFF_WRITE_ERRORS, 'เปิดใช้งานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
}

export function inactiveCoursesSummary(count: number): string {
  return count === 0 ? 'ไม่มีรายวิชาที่ปิดใช้งาน' : `รายวิชาที่ปิดใช้งาน ${count} วิชา`;
}
