import { ChevronRight } from 'lucide-react';
import type { StudentRosterEntry } from '@eduanalyze-ai/shared-types';
import type { Grade } from '@eduanalyze-ai/shared-types';
import { gradeBadgeTone } from '@/lib/grade-badge-color';
import { LOW_GRADE_LABEL, isLowGrade } from '@/lib/low-grade';
import { GradeSelectConfirm } from '@/components/academic-record/grade-select-confirm';
import { Button } from '@/components/ui/button';
import { GradeChip } from './grade-chip';
import { STUDENT_CARD_MAIN, StudentCardFrame, StudentIdentity } from './student-card';

// One student of the roster. In view mode the whole row opens the student's
// timeline; in edit mode the grade select and the delete step sit beside it.
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
  return (
    <StudentCardFrame
      accent={accent}
      accentNote={LOW_GRADE_LABEL}
      selected={isSelected}
      interactive={!editable}
    >
      <div className="flex flex-1 items-center">
        <button
          type="button"
          aria-pressed={isSelected}
          aria-label={
            accent ? `${student.fullName} ${student.studentCode} ${LOW_GRADE_LABEL}` : undefined
          }
          onClick={onToggleSelect}
          className={STUDENT_CARD_MAIN}
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
          <div className="shrink-0 pr-5">
            <GradeSelectConfirm
              value={student.grade}
              subject={student.fullName}
              disabled={isBusy}
              onConfirm={onGradeConfirm}
            />
          </div>
        )}
      </div>
      {editable && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-2">
          {isConfirmingDelete ? (
            <>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isBusy}
                aria-label={`ยืนยันลบผลการเรียนของ ${student.fullName}`}
                onClick={onConfirmDelete}
              >
                ยืนยันลบ
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={onCancelDelete}
              >
                ยกเลิก
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isBusy}
              aria-label={`ลบผลการเรียนของ ${student.fullName}`}
              onClick={onAskDelete}
            >
              ลบ
            </Button>
          )}
        </div>
      )}
    </StudentCardFrame>
  );
}
