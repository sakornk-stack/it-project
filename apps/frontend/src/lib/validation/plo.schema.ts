import { z } from 'zod';

// Mirrors CreatePloDto: code <= 20, name <= 255, description optional free text.
// The curriculum comes from the page, not this form.
export const ploSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'กรุณากรอกรหัส PLO')
    .max(20, 'รหัส PLO ยาวเกินไป (สูงสุด 20 ตัวอักษร)'),
  name: z.string().trim().min(1, 'กรุณากรอกชื่อ PLO').max(255, 'ชื่อ PLO ยาวเกินไป'),
  description: z.string(),
});

export type PloFormValues = z.infer<typeof ploSchema>;
