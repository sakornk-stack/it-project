'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Download, Pencil, Users } from 'lucide-react';
import type { CloAchievementEntry, Grade, StudentRosterEntry } from '@eduanalyze-ai/shared-types';
import { deleteCourseRecord, updateCourseRecordGrade } from '@/lib/api/academic-record';
import {
  GRADE_WRITE_ERRORS,
  GRADE_WRITE_FALLBACK,
  OWN_SENTENCE_ONLY,
} from '@/lib/api-error-presets';
import { describeApiError } from '@/lib/describe-api-error';
import { gradeBadgeTone } from '@/lib/grade-badge-color';
import { GRADE_LABELS, GRADE_OPTIONS } from '@/lib/grade-label';
import { LOW_GRADE_LABEL, isLowGrade } from '@/lib/low-grade';
import {
  ALL,
  countPeople,
  sortPeopleBy,
  type GradeFilter,
  type PeopleSort,
} from '@/lib/student-directory';
import { downloadCsv, toCsv } from '@/lib/csv';
import { useToast } from '@/lib/toast-context';
import { usePagination } from '@/lib/use-pagination';
import { cn } from '@/lib/utils';
import { GradeSelectConfirm } from '@/components/academic-record/grade-select-confirm';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { ListSkeleton } from '@/components/ui/skeleton';
import { GradeChip } from './grade-chip';
import { StudentFilterBar } from './student-filter-bar';
import {
  STUDENT_CARD_MAIN,
  StudentCardFrame,
  StudentCardGrid,
  StudentIdentity,
  StudentListStatus,
} from './student-card';
import { SectionCard } from './section-card';
import { StudentTimelineCard } from './student-timeline-card';

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
function exportRosterCsvWithToast(
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
  onChanged,
  initialSelectedStudentId,
}: {
  courseId: string;
  courseCode: string;
  clos: CloAchievementEntry[];
  roster: StudentRosterEntry[] | undefined;
  isLoading: boolean;
  isError: boolean;
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

  // Filters live in the URL (?grade=low ?q=) so a reload or Back lands on the same
  // view; replace, not push, so filtering does not pile up history.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const gradeFilter: GradeFilter = searchParams.get('grade') === 'low' ? 'LOW' : ALL;
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const updateParams = useCallback(
    (changes: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === '') params.delete(key);
        else params.set(key, value);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const editable = !!onChanged && editMode;

  // Low grades first, then by code.
  const ordered = useMemo(
    () =>
      [...(roster ?? [])].sort(
        (a, b) =>
          Number(isLowGrade(b.grade)) - Number(isLowGrade(a.grade)) ||
          a.studentCode.localeCompare(b.studentCode),
      ),
    [roster],
  );

  // Search narrows first and the counts follow it, so each button shows
  // how many people it would leave.
  const searched = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term === ''
      ? ordered
      : ordered.filter(
          (student) =>
            student.studentCode.toLowerCase().includes(term) ||
            student.fullName.toLowerCase().includes(term),
        );
  }, [ordered, search]);
  const counts = useMemo(
    () => countPeople(searched.map((s) => ({ hasLowGrade: isLowGrade(s.grade) }))),
    [searched],
  );
  const visibleRoster = useMemo(
    () => (gradeFilter === ALL ? searched : searched.filter((s) => isLowGrade(s.grade))),
    [searched, gradeFilter],
  );

  const isFiltered = search.trim() !== '' || gradeFilter !== ALL;

  const [sortKey, setSortKey] = useState<PeopleSort>('risk');
  const sorted = useMemo(() => sortPeopleBy(visibleRoster, sortKey), [visibleRoster, sortKey]);
  const pagination = usePagination(sorted, 12, `${search}|${gradeFilter}|${sortKey}`);

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

  function clearFilters() {
    setSearch('');
    updateParams({ grade: null, q: null });
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
      <Alert variant="destructive">
        <AlertDescription>ไม่สามารถโหลดรายชื่อนิสิตได้ กรุณาลองใหม่อีกครั้ง</AlertDescription>
      </Alert>,
    );
  }
  if (roster.length === 0) {
    return frame(
      <EmptyState
        illustration="no-students"
        description="ยังไม่มีนิสิตลงทะเบียนในรายวิชานี้ รายชื่อจะขึ้นที่นี่เมื่อมีผู้ลงทะเบียน"
      />,
    );
  }

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {onChanged && (
        <Button
          type="button"
          variant={editMode ? 'default' : 'outline'}
          aria-pressed={editMode}
          className="h-11 "
          onClick={() => setEditMode((on) => !on)}
        >
          <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {editMode ? 'เสร็จสิ้นการแก้ไข' : 'แก้ไขเกรด'}
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        className="h-11 "
        disabled={visibleRoster.length === 0}
        onClick={() => exportRosterCsvWithToast(courseCode, sorted, isFiltered, toast)}
      >
        <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
        ส่งออก CSV
      </Button>
    </div>
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
                const recordId = student.studentCourseRecordId;
                const isBusy = busyId === recordId;
                const isSelected = selectedStudentId === student.studentProfileId;
                const accent = isLowGrade(student.grade) ? gradeBadgeTone(student.grade) : null;
                return (
                  <li key={student.studentProfileId} className="h-full">
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
                            accent
                              ? `${student.fullName} ${student.studentCode} ${LOW_GRADE_LABEL}`
                              : undefined
                          }
                          onClick={() =>
                            setSelectedStudentId(isSelected ? null : student.studentProfileId)
                          }
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
                          <div className="shrink-0 pr-5 [&_[role=combobox]]:h-11 [&_button]:min-h-11">
                            <GradeSelectConfirm
                              value={student.grade}
                              subject={student.fullName}
                              disabled={isBusy}
                              onConfirm={(grade) =>
                                runWrite(
                                  recordId,
                                  () => updateCourseRecordGrade(recordId, { grade }),
                                  'บันทึกเกรดแล้ว',
                                )
                              }
                            />
                          </div>
                        )}
                      </div>
                      {editable && (
                        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-2">
                          {confirmingId === recordId ? (
                            <>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={isBusy}
                                aria-label={`ยืนยันลบผลการเรียนของ ${student.fullName}`}
                                onClick={() =>
                                  runWrite(
                                    recordId,
                                    () => deleteCourseRecord(recordId),
                                    'ลบผลการเรียนแล้ว',
                                  )
                                }
                              >
                                ยืนยันลบ
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isBusy}
                                onClick={() => setConfirmingId(null)}
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
                              onClick={() => setConfirmingId(recordId)}
                            >
                              ลบ
                            </Button>
                          )}
                        </div>
                      )}
                    </StudentCardFrame>
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
              <div className="lg:sticky lg:top-4 lg:self-start">
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
