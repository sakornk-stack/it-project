import type { StudentCourseRecord } from '@eduanalyze-ai/shared-types';

export const LOCKED_RECORD_NOTE = 'บันทึกโดยเจ้าหน้าที่หรืออาจารย์ แก้ไขหรือลบเองไม่ได้';

// Mirrors the backend rule: a student may change only rows they entered
// themselves (null = a legacy row from before the writer was recorded).
export function isSelfEnteredRecord(record: Pick<StudentCourseRecord, 'enteredByRole'>): boolean {
  return !record.enteredByRole || record.enteredByRole === 'STUDENT';
}
