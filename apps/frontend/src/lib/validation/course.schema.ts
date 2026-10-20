import { z } from 'zod';

// Mirrors CreateCourseDto (MIN/MAX_COURSE_CREDITS) — curriculumId/categoryId
// come from page context, not this form.
export const MAX_COURSE_CREDITS = 12;

export const courseSchema = z.object({
  code: z.string().min(1, 'กรุณากรอกรหัสวิชา').max(20, 'รหัสวิชายาวเกินไป'),
  name: z.string().min(1, 'กรุณากรอกชื่อวิชา').max(255, 'ชื่อวิชายาวเกินไป'),
  nameEn: z.string().max(255, 'ชื่อวิชา (อังกฤษ) ยาวเกินไป').optional().or(z.literal('')),
  credits: z.coerce
    .number({ invalid_type_error: 'กรุณากรอกหน่วยกิต' })
    .int('หน่วยกิตต้องเป็นจำนวนเต็ม')
    .min(0, 'หน่วยกิตต้องไม่ติดลบ')
    .max(MAX_COURSE_CREDITS, `หน่วยกิตต้องไม่เกิน ${MAX_COURSE_CREDITS}`),
  description: z.string().optional().or(z.literal('')),
  isRequired: z.boolean().optional(),
});

export type CourseFormValues = z.infer<typeof courseSchema>;
