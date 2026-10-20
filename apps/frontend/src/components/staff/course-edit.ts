import { z } from 'zod';
import type {
  CourseListItem,
  CreateCourseRequest,
  UpdateCourseRequest,
} from '@eduanalyze-ai/shared-types';
import { courseSchema } from '@/lib/validation/course.schema';
import { STAFF_WRITE_ERRORS } from '@/lib/api-error-presets';
import { describeApiError } from '@/lib/describe-api-error';

// The form for adding and editing a course. The fields are exactly the ones
// PATCH /courses/:id accepts (UpdateCourseDto = CreateCourseDto without the
// curriculum); the curriculum is shown, never edited. Removing a course is a
// separate, confirmed action (DELETE /courses/:id) at the foot of the sheet.
export const courseEditSchema = courseSchema.extend({
  categoryId: z.string().uuid('กรุณาเลือกหมวดวิชา'),
});

export type CourseEditValues = z.infer<typeof courseEditSchema>;

export const EDITABLE_COURSE_FIELDS = [
  'code',
  'name',
  'nameEn',
  'credits',
  'description',
  'isRequired',
  'categoryId',
] as const;

export function courseToFormValues(course: CourseListItem): CourseEditValues {
  return {
    code: course.code,
    name: course.name,
    nameEn: course.nameEn ?? '',
    credits: course.credits,
    // The list endpoint does not return the description, so it is left empty
    // and only sent when the user types one.
    description: '',
    isRequired: course.isRequired,
    categoryId: course.categoryId,
  };
}

// Empty text is sent as '' so a cleared English name is cleared; description
// is only sent when typed, since the form could not show the stored one.
export function toUpdateBody(values: CourseEditValues): UpdateCourseRequest {
  return {
    code: values.code,
    name: values.name,
    nameEn: values.nameEn ?? '',
    credits: values.credits,
    ...(values.description ? { description: values.description } : {}),
    isRequired: values.isRequired ?? true,
    categoryId: values.categoryId,
  };
}

export function toCreateBody(curriculumId: string, values: CourseEditValues): CreateCourseRequest {
  return {
    curriculumId,
    categoryId: values.categoryId,
    code: values.code,
    name: values.name,
    nameEn: values.nameEn || undefined,
    credits: values.credits,
    description: values.description || undefined,
    isRequired: values.isRequired ?? true,
  };
}

export const COURSE_DELETE_WARNING =
  'รายวิชานี้จะถูกปิดใช้งานและนำออกจากหลักสูตร (เปิดใช้งานกลับได้ภายหลัง) ไม่สามารถลบได้หากมีผลการเรียน อาจารย์ผู้รับผิดชอบ ผลลัพธ์การเรียนรู้ หรือการเชื่อมโยงกับอาชีพผูกอยู่ วิชาบังคับก่อนของวิชานี้จะถูกลบออก';

export function courseDeleteTitle(course: Pick<CourseListItem, 'code' | 'name'>): string {
  return `ลบรายวิชา ${course.code} ${course.name}?`;
}

// DELETE /courses/:id answers a blocked delete with a 409 whose Thai message
// names what is still attached, so unlike the save errors the server's own
// sentence is shown (anything not in Thai falls back to a generic one).
export function describeCourseDeleteError(error: unknown): string {
  return describeApiError(error, STAFF_WRITE_ERRORS);
}

export const CATEGORY_DELETE_BLOCKED =
  'ลบหมวดไม่ได้ เพราะยังมีรายวิชาอยู่ในหมวดนี้ กรุณาลบหรือย้ายรายวิชาออกก่อน';
