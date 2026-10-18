import { z } from 'zod';

// Mirrors CreateStudentCourseRecordDto — courseId/semesterId/grade all
// required. Values only ever come from <Select> options built from real
// API data (never free text), so "must exist in the system" is enforced
// by construction here, not by this schema.
export const courseRecordSchema = z.object({
  courseId: z.string().uuid('กรุณาเลือกวิชา'),
  semesterId: z.string().uuid('กรุณาเลือกภาคเรียน'),
  grade: z.enum(
    ['A', 'B_PLUS', 'B', 'C_PLUS', 'C', 'D_PLUS', 'D', 'F', 'W', 'I', 'S', 'U'],
    { errorMap: () => ({ message: 'กรุณาเลือกเกรด' }) },
  ),
});

export type CourseRecordFormValues = z.infer<typeof courseRecordSchema>;
