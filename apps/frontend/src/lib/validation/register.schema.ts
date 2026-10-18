import { z } from 'zod';
import { isAllowedSignupEmail, signupDomainError } from '../signup-domain';
import { acceptPrivacyPolicySchema, emailSchema, passwordSchema } from './common';

export const registerSchema = z
  .object({
    // Early hint only; the server enforces SELF_SIGNUP_ALLOWED_DOMAINS.
    email: emailSchema.refine((email) => isAllowedSignupEmail(email), signupDomainError()),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'กรุณายืนยันรหัสผ่าน'),
    fullName: z.string().min(1, 'กรุณากรอกชื่อ-นามสกุล').max(255),
    studentCode: z.string().min(1, 'กรุณากรอกรหัสนิสิต'),
    facultyId: z.string().uuid('กรุณาเลือกคณะ'),
    departmentId: z.string().uuid('กรุณาเลือกภาควิชา'),
    programId: z.string().uuid('กรุณาเลือกหลักสูตร'),
    curriculumId: z.string().uuid('กรุณาเลือกฉบับหลักสูตร'),
    admissionYear: z.coerce
      .number()
      .int()
      .min(2400, 'ปีการศึกษาไม่ถูกต้อง')
      .max(2700, 'ปีการศึกษาไม่ถูกต้อง'),
    acceptPrivacyPolicy: acceptPrivacyPolicySchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'รหัสผ่านไม่ตรงกัน',
    path: ['confirmPassword'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
