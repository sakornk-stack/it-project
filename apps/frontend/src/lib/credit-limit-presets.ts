import type { CreditLimitRequestType } from '@eduanalyze-ai/shared-types';

// No minimum-credit warning existed in the planner before this feature —
// 9 is a new, standalone constant (not read from Curriculum, which only
// has maxCreditsPerSemester) purely to give the BELOW_MIN preset a
// warning to relax. It is a value we set ourselves, NOT a confirmed university
// rule — pending confirmation with the registrar; the planner shows it as advice
// (amber), not a prohibition.
export const MIN_CREDITS_WARNING = 9;

export const CREDIT_LIMIT_PRESETS: Record<
  CreditLimitRequestType,
  { label: string; effectiveMax?: number; effectiveMin?: number }
> = {
  EXCEED_MAX: { label: '23-25 หน่วยกิต', effectiveMax: 25 },
  BELOW_MIN: { label: 'ต่ำกว่า 9 หน่วยกิต', effectiveMin: 0 },
};

// Shown inside the form: the setting is the student's own and nobody reviews it.
export const CREDIT_LIMIT_SELF_SET_NOTE =
  'ตั้งค่านี้ใช้กับแผนของคุณเท่านั้น ไม่ได้ส่งให้ผู้อนุมัติ และไม่ใช่การลงทะเบียน';
