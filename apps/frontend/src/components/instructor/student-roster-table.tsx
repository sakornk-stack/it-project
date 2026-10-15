'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Users } from 'lucide-react';
import type { CloAchievementEntry, StudentRosterEntry } from '@eduanalyze-ai/shared-types';
import { deleteCourseRecord, updateCourseRecordGrade } from '@/lib/api/academic-record';
import {
  GRADE_WRITE_ERRORS,
  GRADE_WRITE_FALLBACK,
  OWN_SENTENCE_ONLY,
} from '@/lib/api-error-presets';
import { describeApiError } from '@/lib/describe-api-error';
import { exportRosterCsvWithToast } from '@/lib/roster-csv';
import { ALL } from '@/lib/student-directory';
import { useToast } from '@/lib/toast-context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { ListSkeleton } from '@/components/ui/skeleton';
import { StudentFilterBar } from './student-filter-bar';
import { StudentCardGrid, StudentListStatus } from './student-card';
import { RosterActions } from './roster-actions';
import { RosterStudentCard } from './roster-student-card';
import { useRosterView } from './use-roster-view';
import { SectionCard } from './section-card';
import { StudentTimelineCard } from './student-timeline-card';

// The list opens in view mode. Grade editing and deleting appear only after
// "แก้ไขเกรด" is pressed, and only when onChanged is passed (the instructor's
// own course), so a stray tap cannot reach a write. Rows are each student's
// latest attempt only, so removing one can surface an earlier attempt.
//
// One markup for every width: each student is a card that stacks on phones and
// lines up on wider screens, so no second table is rendered and nothing
// scrolls sideways.
export function StudentRosterTable({
  courseId,
  courseCode,
  clos,
  roster,
  isLoading,
  isError,
  onRetry,
  onChanged,
  initialSelectedStudentId,
}: {
  courseId: string;
  courseCode: string;
  clos: CloAchievementEntry[];
  roster: StudentRosterEntry[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onChanged?: () => void;
  // Lets a link elsewhere (at-risk card, CLO fail list, students page) land
  // directly on this student's row instead of just opening the tab —
  // seeded once on mount, same as any other deep-link param.
  initialSelectedStudentId?: string;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const toast = useToast();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    initialSelectedStudentId ?? null,
  );
  const [editMode, setEditMode] = useState(false);

  const editable = !!onChanged && editMode;

  const {
    gradeFilter,
    search,
    setSearch,
    updateParams,
    counts,
    visibleRoster,
    isFiltered,
    sortKey,
    setSortKey,
    sorted,
    pagination,
    clearFilters,
  } = useRosterView(roster);

  // Below lg the student's panel stacks under the list: bring it into view when a
  // student is picked (not for the one a deep link opened), without the glide
  // when the reader asked for reduced motion.
  const panelRef = useRef<HTMLDivElement>(null);
  const seededSelection = useRef(initialSelectedStudentId ?? null);
  useEffect(() => {
    if (!selectedStudentId) return;
    if (seededSelection.current === selectedStudentId) {
      seededSelection.current = null;
      return;
    }
    if (!window.matchMedia('(max-width: 1023px)').matches) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    panelRef.current?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
  }, [selectedStudentId]);

  // A row left awaiting delete-confirmation must not stay armed once it
  // has scrolled to another page or moved under a re-sort, or once editing
  // is switched off.
  useEffect(() => {
    setConfirmingId(null);
  }, [pagination.page, sortKey, editMode]);

  // The timeline card is opened from a row, so it has to close when that
  // row is filtered away — otherwise it hangs below the list with no
  // visible student to tie it back to. Skipped while roster is still
  // loading: `roster` is undefined then, so visibleRoster is an empty
  // placeholder that would otherwise look like "filtered away" and wipe
  // out a selection seeded from a deep link (initialSelectedStudentId)
  // before the real data ever arrives.
  useEffect(() => {
    if (!roster) return;
    if (selectedStudentId && !visibleRoster.some((s) => s.studentProfileId === selectedStudentId)) {
      setSelectedStudentId(null);
    }
  }, [roster, visibleRoster, selectedStudentId]);

  async function runWrite(
    recordId: string,
    action: () => Promise<unknown>,
    successMessage: string,
  ) {
    setBusyId(recordId);
    try {
      await action();
      setConfirmingId(null);
      onChanged?.();
      toast.success(successMessage);
    } catch (error) {
      toast.error(
        describeApiError(error, GRADE_WRITE_ERRORS, GRADE_WRITE_FALLBACK, OWN_SENTENCE_ONLY),
      );
    } finally {
      setBusyId(null);
    }
  }

  const frame = (body: ReactNode, aside?: ReactNode) => (
    <SectionCard
      icon={Users}
      title="รายชื่อนิสิต"
      description="ค้นหา เรียงลำดับ และเปิดดูผลการเรียนของนิสิตแต่ละคนในวิชานี้"
      aside={aside}
    >
      {body}
    </SectionCard>
  );

  if (isLoading) {
    return frame(<ListSkeleton items={4} />);
  }
  if (isError || !roster) {
    return frame(
      <ApiErrorAlert
        message="ไม่สามารถโหลดรายชื่อนิสิตได้ กรุณาลองใหม่อีกครั้ง"
        onRetry={onRetry}
      />,
    );
  }
  if (roster.length === 0) {
    return frame(
      <EmptyState
        illustration="no-students"
        description="ยังไม่มีนิสิตในรายวิชานี้ รายชื่อจะขึ้นที่นี่เมื่อมีนิสิตเรียนวิชานี้"
      />,
    );
  }

  const actions = (
    <RosterActions
      canEdit={!!onChanged}
      editMode={editMode}
      onToggleEdit={() => setEditMode((on) => !on)}
      canExport={visibleRoster.length > 0}
      onExport={() => exportRosterCsvWithToast(courseCode, sorted, isFiltered, toast)}
    />
  );

  return frame(
    <div className="space-y-4">
      <StudentFilterBar
        counts={counts}
        grade={gradeFilter}
        onGradeChange={(grade) => updateParams({ grade: grade === 'LOW' ? 'low' : null })}
        courses={[]}
        courseId={ALL}
        onCourseChange={() => undefined}
        search={search}
        onSearchChange={(q) => {
          setSearch(q);
          updateParams({ q: q.trim() === '' ? null : q.trim() });
        }}
        sort={sortKey}
        onSortChange={setSortKey}
        isFiltered={isFiltered}
        onClear={clearFilters}
      />

      {editable && (
        <p className="text-xs text-muted-foreground">
          นิสิตเป็นผู้บันทึกผลการเรียนเอง — ใช้โหมดนี้เพื่อแก้ไขกรณีเกรดผิดเท่านั้น
          แสดงเฉพาะผลการเรียนครั้งล่าสุดของแต่ละคน
        </p>
      )}

      <StudentListStatus shown={visibleRoster.length} total={roster.length} sort={sortKey} />

      {/* Two columns only once a student is picked, so an unselected list
          keeps the full width. minmax(0,1fr) rather than 1fr: a 1fr track
          defaults to min-width:auto, which would let a wide child push the
          panel off screen instead of wrapping inside its own box. */}
      <div className={cn('grid gap-4', selectedStudentId && 'lg:grid-cols-[minmax(0,1fr)_340px]')}>
        <div className="min-w-0">
          {visibleRoster.length === 0 ? (
            <EmptyState
              illustration="no-results"
              description="ไม่พบนิสิตที่ตรงกับเงื่อนไขที่เลือก"
              action={
                <Button type="button" variant="outline" onClick={clearFilters}>
                  ล้างตัวกรอง
                </Button>
              }
            />
          ) : (
            <StudentCardGrid compact={!!selectedStudentId}>
              {pagination.pageRows.map((student) => {
                return (
                  <li key={student.studentProfileId} className="h-full">
                    <RosterStudentCard
                      student={student}
                      isSelected={selectedStudentId === student.studentProfileId}
                      editable={editable}
                      isBusy={busyId === student.studentCourseRecordId}
                      isConfirmingDelete={confirmingId === student.studentCourseRecordId}
                      onToggleSelect={() =>
                        setSelectedStudentId(
                          selectedStudentId === student.studentProfileId
                            ? null
                            : student.studentProfileId,
                        )
                      }
                      onGradeConfirm={(grade) =>
                        runWrite(
                          student.studentCourseRecordId,
                          () => updateCourseRecordGrade(student.studentCourseRecordId, { grade }),
                          'บันทึกเกรดแล้ว',
                        )
                      }
                      onAskDelete={() => setConfirmingId(student.studentCourseRecordId)}
                      onConfirmDelete={() =>
                        runWrite(
                          student.studentCourseRecordId,
                          () => deleteCourseRecord(student.studentCourseRecordId),
                          'ลบผลการเรียนแล้ว',
                        )
                      }
                      onCancelDelete={() => setConfirmingId(null)}
                    />
                  </li>
                );
              })}
            </StudentCardGrid>
          )}
          {pagination.total > 0 && (
            <Pagination {...pagination} unit="คน" onPageChange={pagination.setPage} />
          )}
        </div>
        {/* self-start stops the grid stretching this cell to the row
            height, which would leave sticky with nothing to scroll past. */}
        {selectedStudentId &&
          (() => {
            const selected = visibleRoster.find((s) => s.studentProfileId === selectedStudentId);
            if (!selected) return null;
            return (
              <div ref={panelRef} className="scroll-mt-4 lg:sticky lg:top-4 lg:self-start">
                <StudentTimelineCard
                  courseId={courseId}
                  courseCode={courseCode}
                  studentProfileId={selectedStudentId}
                  studentCourseRecordId={selected.studentCourseRecordId}
                  clos={clos}
                  onClose={() => setSelectedStudentId(null)}
                />
              </div>
            );
          })()}
      </div>
    </div>,
    actions,
  );
}
