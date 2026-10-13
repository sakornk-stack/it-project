import { AxiosError } from 'axios';
import type { CourseListItem } from '@eduanalyze-ai/shared-types';
import {
  CATEGORY_DELETE_BLOCKED,
  COURSE_DELETE_WARNING,
  courseDeleteTitle,
  courseEditSchema,
  describeCourseDeleteError,
  courseToFormValues,
  EDITABLE_COURSE_FIELDS,
  toCreateBody,
  toUpdateBody,
} from './course-edit';

const UUID = '00000000-0000-4000-8000-000000000001';
const course: CourseListItem = {
  id: 'x',
  code: 'CPE101',
  name: 'ชื่อ',
  nameEn: null,
  credits: 3,
  isRequired: true,
  isActive: true,
  curriculumId: 'C1',
  categoryId: UUID,
};

describe('toUpdateBody', () => {
  it('sends only the seven editable fields — never isActive or curriculumId', () => {
    const body = toUpdateBody({ ...courseToFormValues(course), description: 'รายละเอียด' });
    expect(Object.keys(body).sort()).toEqual([...EDITABLE_COURSE_FIELDS].sort());
    expect(body).not.toHaveProperty('isActive');
    expect(body).not.toHaveProperty('curriculumId');
  });

  it('clears the English name when it is emptied, and keeps the stored description when untouched', () => {
    const body = toUpdateBody({
      ...courseToFormValues({ ...course, nameEn: 'Intro' }),
      nameEn: '',
    });
    expect(body.nameEn).toBe('');
    expect(body).not.toHaveProperty('description');
  });
});

describe('toCreateBody', () => {
  it('carries the curriculum from the page and leaves empty optionals out', () => {
    const body = toCreateBody('C1', courseToFormValues(course));
    expect(body.curriculumId).toBe('C1');
    expect(body.nameEn).toBeUndefined();
    expect(body.description).toBeUndefined();
  });
});

describe('courseEditSchema', () => {
  const ok = courseToFormValues(course);

  it('accepts a course as the backend would', () => {
    expect(courseEditSchema.safeParse(ok).success).toBe(true);
  });

  it.each([
    ['code over 20', { code: 'x'.repeat(21) }],
    ['empty name', { name: '' }],
    ['name over 255', { name: 'ก'.repeat(256) }],
    ['English name over 255', { nameEn: 'a'.repeat(256) }],
    ['fractional credits', { credits: 2.5 }],
    ['negative credits', { credits: -1 }],
    ['category that is not an id', { categoryId: 'K1' }],
  ])('refuses %s', (_label, change) => {
    expect(courseEditSchema.safeParse({ ...ok, ...change }).success).toBe(false);
  });
});

function apiError(status: number, message: unknown) {
  return new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status,
    data: { message },
  } as never);
}

describe('deleting a course', () => {
  it('names the course in the confirmation and warns about attached data', () => {
    expect(courseDeleteTitle({ code: 'CPE101', name: 'การเขียนโปรแกรม' })).toBe(
      'ลบรายวิชา CPE101 การเขียนโปรแกรม?',
    );
    expect(COURSE_DELETE_WARNING).toContain('ผลการเรียน อาจารย์ผู้รับผิดชอบ');
  });

  it('shows the Thai 409 message from the server as is', () => {
    const message = 'ปิดวิชานี้ไม่ได้ เพราะยังมีข้อมูลผูกอยู่: ผลการเรียนของนิสิต 3 รายการ';
    expect(describeCourseDeleteError(apiError(409, message))).toBe(message);
  });

  it('explains a 403 as out of scope and never leaks English or network text', () => {
    expect(describeCourseDeleteError(apiError(403, 'Forbidden'))).toContain('อยู่นอกขอบเขต');
    expect(describeCourseDeleteError(apiError(409, 'Conflict'))).not.toMatch(/[A-Za-z]/);
    expect(describeCourseDeleteError(new Error('Network Error'))).not.toMatch(/[A-Za-z]/);
  });

  it('tells the user how to unblock a category delete', () => {
    expect(CATEGORY_DELETE_BLOCKED).toBe(
      'ลบหมวดไม่ได้ เพราะยังมีรายวิชาอยู่ในหมวดนี้ กรุณาลบหรือย้ายรายวิชาออกก่อน',
    );
  });
});
