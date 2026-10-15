import type { StudentRosterEntry } from '@eduanalyze-ai/shared-types';
import { downloadCsv, toCsv } from '@/lib/csv';
import { GRADE_LABELS } from '@/lib/grade-label';
import { LOW_GRADE_LABEL, isLowGrade } from '@/lib/low-grade';
import type { useToast } from '@/lib/toast-context';

// Exports what the table currently shows, not the whole class — the
// filename says so, otherwise a filtered export is indistinguishable
// from a complete roster once it is off the screen.
function exportRosterCsv(courseCode: string, rows: StudentRosterEntry[], isFiltered: boolean) {
  const csv = toCsv(
    ['รหัสนิสิต', 'ชื่อ-นามสกุล', 'เกรด', LOW_GRADE_LABEL],
    rows.map((student) => [
      student.studentCode,
      student.fullName,
      GRADE_LABELS[student.grade],
      isLowGrade(student.grade) ? 'ใช่' : '',
    ]),
  );
  const today = new Date().toISOString().slice(0, 10);
  downloadCsv(`gradebook-${courseCode}-${today}${isFiltered ? '-filtered' : ''}.csv`, csv);
}

// downloadCsv's Blob/URL.createObjectURL path can throw in constrained
// environments (e.g. an iframe sandbox) — this had no feedback at all
// before, success or failure.
export function exportRosterCsvWithToast(
  courseCode: string,
  rows: StudentRosterEntry[],
  isFiltered: boolean,
  toast: ReturnType<typeof useToast>,
) {
  try {
    exportRosterCsv(courseCode, rows, isFiltered);
    toast.success('ส่งออก CSV แล้ว');
  } catch {
    toast.error('ส่งออก CSV ไม่สำเร็จ');
  }
}
