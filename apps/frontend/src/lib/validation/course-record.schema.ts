import { z } from 'zod';

// Mirrors CreateStudentCourseRecordDto — courseId/semesterId/grade all
// required. Values only ever come from <Select> options built from real
// API data (never free text), so "must exist in the system" is enforced
// by construction here, not by this schema.
export const courseRecordSchema = z.object({
  courseId: z.string().uuid('กรุณาเลือกวิชา'),
  semesterId: z.string().uuid('กรุณาเลือกภาคเรียน'),
  // S/U are no longer accepted as new input (existing records keep them).
  grade: z.enum(['A', 'B_PLUS', 'B', 'C_PLUS', 'C', 'D_PLUS', 'D', 'F', 'W', 'I'], {
    errorMap: () => ({ message: 'กรุณาเลือกเกรด (ไม่รับเกรด S และ U)' }),
  }),
});

export type CourseRecordFormValues = z.infer<typeof courseRecordSchema>;
