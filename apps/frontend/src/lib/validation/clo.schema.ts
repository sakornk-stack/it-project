import { z } from 'zod';

// Mirrors CreateCloDto: code <= 20, threshold an integer 0-100 or left blank to
// use the curriculum default. The course comes from the page, not this form.
export const cloSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'กรุณากรอกรหัส CLO')
    .max(20, 'รหัส CLO ยาวเกินไป (สูงสุด 20 ตัวอักษร)'),
  description: z.string().trim().min(1, 'กรุณากรอกคำอธิบาย CLO'),
  // Kept as text so a blank box means "use the default" instead of 0.
  achievementThreshold: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d+$/.test(v), 'กรุณากรอกจำนวนเต็ม 0–100')
    .refine((v) => v === '' || Number(v) <= 100, 'เกณฑ์ต้องไม่เกิน 100'),
  isConfirmed: z.boolean(),
});

export type CloFormValues = z.infer<typeof cloSchema>;
