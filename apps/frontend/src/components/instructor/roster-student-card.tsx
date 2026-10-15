import { useState } from 'react';
import { ChevronRight, Trash2 } from 'lucide-react';
import type { StudentRosterEntry } from '@eduanalyze-ai/shared-types';
import type { Grade } from '@eduanalyze-ai/shared-types';
import { gradeBadgeTone } from '@/lib/grade-badge-color';
import { LOW_GRADE_LABEL, isLowGrade } from '@/lib/low-grade';
import { GradeSelectConfirm } from '@/components/academic-record/grade-select-confirm';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { GradeChip } from './grade-chip';
import { STUDENT_CARD_MAIN, StudentCardFrame, StudentIdentity } from './student-card';

// One student of the roster. In view mode the whole row opens the student's
// timeline; in edit mode a second row holds the grade select with the delete button,
// and a change or delete waiting for confirmation is asked in the card (grade) or a dialog.
export function RosterStudentCard({
  student,
  isSelected,
  editable,
  isBusy,
  isConfirmingDelete,
  onToggleSelect,
  onGradeConfirm,
  onAskDelete,
  onConfirmDelete,
  onCancelDelete,
}: Readonly<{
  student: StudentRosterEntry;
  isSelected: boolean;
  editable: boolean;
  isBusy: boolean;
  isConfirmingDelete: boolean;
  onToggleSelect: () => void;
  onGradeConfirm: (grade: Grade) => void;
  onAskDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}>) {
  const accent = isLowGrade(student.grade) ? gradeBadgeTone(student.grade) : null;
  // A grade change waiting for its confirmation, or the delete question: this card is
  // the one being edited.
  const [pendingGrade, setPendingGrade] = useState(false);
  const editing = editable && (pendingGrade || isConfirmingDelete);
  return (
    <StudentCardFrame
      accent={accent}
      // In edit mode the tooltip would sit over the controls; aria-label says the same.
      accentNote={editable ? undefined : LOW_GRADE_LABEL}
      selected={isSelected}
      highlighted={editing}
      interactive={!editable}
    >
      <button
        type="button"
        aria-pressed={isSelected}
        aria-label={
          accent ? `${student.fullName} ${student.studentCode} ${LOW_GRADE_LABEL}` : undefined
        }
        onClick={onToggleSelect}
        className={cn(STUDENT_CARD_MAIN, editable && 'flex-none pb-3')}
      >
        <StudentIdentity name={student.fullName} code={student.studentCode} />
        {!editable && (
          <>
            <GradeChip grade={student.grade} />
            <ChevronRight
              size={16}
              aria-hidden="true"
              className="go-arrow shrink-0 text-muted-foreground"
            />
          </>
        )}
      </button>
      {editable && (
        <div className="px-5 pb-4">
          <GradeSelectConfirm
            stacked
            value={student.grade}
            subject={student.fullName}
            disabled={isBusy}
            onConfirm={onGradeConfirm}
            onPendingChange={setPendingGrade}
            trailing={
              <Button
                type="button"
                variant="danger"
                disabled={isBusy}
                aria-label={`ลบผลการเรียนของ ${student.fullName}`}
                className="shrink-0 gap-1.5"
                onClick={onAskDelete}
              >
                <Trash2 size={16} aria-hidden="true" />
                ลบ
              </Button>
            }
          />
        </div>
      )}
      <ConfirmDialog
        open={isConfirmingDelete}
        onOpenChange={(open) => {
          if (!open) onCancelDelete();
        }}
        title="ลบผลการเรียนของนิสิต"
        description={`ต้องการลบผลการเรียนของ ${student.fullName} (${student.studentCode}) ในรายวิชานี้ใช่หรือไม่ หากนิสิตมีผลการเรียนครั้งก่อนหน้า ระบบจะแสดงผลครั้งนั้นแทน และการลบนี้ไม่สามารถย้อนกลับได้`}
        confirmLabel="ลบผลการเรียน"
        busy={isBusy}
        onConfirm={onConfirmDelete}
      />
    </StudentCardFrame>
  );
}
