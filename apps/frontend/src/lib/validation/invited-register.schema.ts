import { z } from 'zod';
import { acceptPrivacyPolicySchema, passwordSchema } from './common';

// Deliberately separate from registerSchema — the invited path collects
// only what the visitor can actually change (fullName, password). Email
// and the academic fields are shown read-only, sourced from the
// StudentInvitation itself; AuthService.register re-resolves them from
// the token server-side regardless of what this form would send.
export const invitedRegisterSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'กรุณายืนยันรหัสผ่าน'),
    fullName: z.string().min(1, 'กรุณากรอกชื่อ-นามสกุล').max(255),
    acceptPrivacyPolicy: acceptPrivacyPolicySchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'รหัสผ่านไม่ตรงกัน',
    path: ['confirmPassword'],
  });

export type InvitedRegisterFormValues = z.infer<typeof invitedRegisterSchema>;
