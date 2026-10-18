import { z } from 'zod';
import { acceptPrivacyPolicySchema } from './common';

export const completeGoogleRegistrationSchema = z.object({
  studentCode: z.string().min(1, 'กรุณากรอกรหัสนิสิต'),
  facultyId: z.string().uuid('กรุณาเลือกคณะ'),
  departmentId: z.string().uuid('กรุณาเลือกภาควิชา'),
  programId: z.string().uuid('กรุณาเลือกหลักสูตร'),
  curriculumId: z.string().uuid('กรุณาเลือกฉบับหลักสูตร'),
  admissionYear: z.coerce
    .number({ invalid_type_error: 'กรุณากรอกปีที่เข้าศึกษา (พ.ศ.)' })
    .int()
    .min(2400, 'ปีการศึกษาไม่ถูกต้อง')
    .max(2700, 'ปีการศึกษาไม่ถูกต้อง'),
  acceptPrivacyPolicy: acceptPrivacyPolicySchema,
});

export type CompleteGoogleRegistrationFormValues = z.infer<
  typeof completeGoogleRegistrationSchema
>;
