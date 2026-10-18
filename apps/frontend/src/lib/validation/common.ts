import { z } from 'zod';
import { PRIVACY_CONSENT_REQUIRED } from '../privacy-policy';

// Mirrors RegisterDto/LoginDto etc.'s class-validator rules on the
// backend — instant client-side feedback only, the backend stays the
// source of truth and re-validates independently.
export const emailSchema = z.string().email('อีเมลไม่ถูกต้อง');

export const passwordSchema = z
  .string()
  .min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
    'รหัสผ่านต้องมีตัวพิมพ์เล็ก ตัวพิมพ์ใหญ่ และตัวเลขอย่างน้อยอย่างละ 1 ตัว',
  );

// The sign-up consent box. A boolean (default false) so the form can start
// unticked; only `true` passes, matching RegisterDto's @Equals(true).
export const acceptPrivacyPolicySchema = z
  .boolean()
  .refine((accepted) => accepted, PRIVACY_CONSENT_REQUIRED);
