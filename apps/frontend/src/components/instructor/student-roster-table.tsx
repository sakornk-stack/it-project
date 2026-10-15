'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowUpDown,
  ChevronRight,
  ChevronUp,
  Download,
  Pencil,
  Search,
  Users,
  X,
} from 'lucide-react';
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
import { ALL, countPeople, type GradeFilter } from '@/lib/student-directory';
import { downloadCsv, toCsv } from '@/lib/csv';
import { useToast } from '@/lib/toast-context';
import { usePagination } from '@/lib/use-pagination';
import { ACCENT_TONE_CLASSES } from '@/lib/tone';
import { useTableSort, type SortControl } from '@/lib/use-table-sort';
import { cn } from '@/lib/utils';
import { StatCard } from '@/components/dashboard/stat-card';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { GradeSelectConfirm } from '@/components/academic-record/grade-select-confirm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { ListSkeleton } from '@/components/ui/skeleton';
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

  const sort = useTableSort(visibleRoster, {
    studentCode: (s) => s.studentCode,
    fullName: (s) => s.fullName,
    grade: (s) => GRADE_OPTIONS.indexOf(s.grade),
    lowGrade: (s) => (isLowGrade(s.grade) ? 0 : 1),
  });
  const pagination = usePagination(
    sort.sorted,
    undefined,
    `${search}|${gradeFilter}|${sort.sortKey}|${sort.direction}`,
  );

  // A row left awaiting delete-confirmation must not stay armed once it
  // has scrolled to another page or moved under a re-sort, or once editing
  // is switched off.
  useEffect(() => {
    setConfirmingId(null);
  }, [pagination.page, sort.sortKey, sort.direction, editMode]);

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

  if (isLoading) {
    return <ListSkeleton items={4} />;
  }
  if (isError || !roster) {
    return (
      <Alert variant="destructive">
        <AlertDescription>ไม่สามารถโหลดรายชื่อนิสิตได้ กรุณาลองใหม่อีกครั้ง</AlertDescription>
      </Alert>
    );
  }
  if (roster.length === 0) {
    return (
      <EmptyState
        illustration="no-students"
        description="ยังไม่มีนิสิตลงทะเบียนในรายวิชานี้ รายชื่อจะขึ้นที่นี่เมื่อมีผู้ลงทะเบียน"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Same pattern as the filter cards on the user list: each card is a toggle. */}
      <div
        role="group"
        aria-label="กรองตามเกรดล่าสุด"
        className="grid grid-cols-2 gap-3 sm:max-w-lg"
      >
        <StatCard
          dense
          icon={Users}
          label="ทั้งหมด"
          value={<AnimatedNumber value={counts.total} />}
          caption="นิสิตในผลการค้นหา"
          dimmed={counts.total === 0}
          selected={gradeFilter === ALL}
          onSelect={() => updateParams({ grade: null })}
        />
        <StatCard
          dense
          tone="warning"
          icon={AlertTriangle}
          label={LOW_GRADE_LABEL}
          value={<AnimatedNumber value={counts.low} />}
          caption="เกรดล่าสุด D+, D, F หรือ U"
          dimmed={counts.low === 0}
          selected={gradeFilter === 'LOW'}
          onSelect={() => updateParams({ grade: gradeFilter === 'LOW' ? null : 'low' })}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-52 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              updateParams({ q: e.target.value.trim() === '' ? null : e.target.value.trim() });
            }}
            placeholder="ค้นหารหัสนิสิต หรือ ชื่อ"
            aria-label="ค้นหารหัสนิสิต หรือ ชื่อ"
            className="px-9 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {search !== '' && (
            <button
              type="button"
              aria-label="ล้างคำค้นหา"
              onClick={() => {
                setSearch('');
                updateParams({ q: null });
              }}
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          {onChanged && (
            <Button
              type="button"
              variant={editMode ? 'default' : 'outline'}
              aria-pressed={editMode}
              className="min-h-11 w-full sm:w-auto"
              onClick={() => setEditMode((on) => !on)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {editMode ? 'เสร็จสิ้นการแก้ไข' : 'แก้ไขเกรด'}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full sm:w-auto"
            disabled={visibleRoster.length === 0}
            onClick={() => exportRosterCsvWithToast(courseCode, sort.sorted, isFiltered, toast)}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            ส่งออก CSV
          </Button>
        </div>
      </div>

      {editable && (
        <p className="text-xs text-muted-foreground">
          นิสิตเป็นผู้บันทึกผลการเรียนเอง — ใช้โหมดนี้เพื่อแก้ไขกรณีเกรดผิดเท่านั้น
          แสดงเฉพาะผลการเรียนครั้งล่าสุดของแต่ละคน
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div
          role="group"
          aria-label="เรียงลำดับรายชื่อ"
          className="flex flex-wrap items-center gap-1"
        >
          <span className="text-xs text-muted-foreground">เรียงตาม</span>
          <SortChip control={sort.sortProps('lowGrade')}>เกรดต่ำก่อน</SortChip>
          <SortChip control={sort.sortProps('studentCode')}>รหัส</SortChip>
          <SortChip control={sort.sortProps('fullName')}>ชื่อ</SortChip>
          <SortChip control={sort.sortProps('grade')}>เกรด</SortChip>
        </div>
        <div className="flex items-center gap-2">
          <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
            แสดง {visibleRoster.length} จาก {roster.length} คน
          </p>
          {isFiltered && (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              ล้างตัวกรอง
            </Button>
          )}
        </div>
      </div>

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
            <ul className="space-y-2">
              {pagination.pageRows.map((student) => {
                const recordId = student.studentCourseRecordId;
                const isBusy = busyId === recordId;
                const isSelected = selectedStudentId === student.studentProfileId;

                const low = isLowGrade(student.grade);
                return (
                  <li
                    key={student.studentProfileId}
                    className={cn(
                      'relative rounded-lg border border-l-4 px-3 py-2',
                      !editable && 'interactive-row',
                      isSelected ? 'border-brand bg-brand-light' : 'border-slate-200',
                      ACCENT_TONE_CLASSES[low ? gradeBadgeTone(student.grade) : 'neutral'],
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() =>
                          setSelectedStudentId(isSelected ? null : student.studentProfileId)
                        }
                        className={cn(
                          'flex min-h-11 min-w-0 flex-1 basis-48 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                          // View mode: the whole row is the hit area.
                          !editable && "after:absolute after:inset-0 after:content-['']",
                        )}
                      >
                        <InitialsAvatar name={student.fullName} />
                        <span className="min-w-0">
                          <span
                            className={cn(
                              'block break-words font-medium text-primary',
                              isSelected && 'underline',
                            )}
                          >
                            {student.fullName}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            <span className="font-mono">{student.studentCode}</span>
                          </span>
                        </span>
                      </button>
                      <div className="flex flex-wrap items-center gap-2">
                        {editable ? (
                          <div className="[&_[role=combobox]]:h-11 [&_button]:min-h-11">
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
                        ) : (
                          <>
                            <Badge tone={gradeBadgeTone(student.grade)}>
                              เกรด {GRADE_LABELS[student.grade]}
                            </Badge>
                            <ChevronRight
                              size={16}
                              aria-hidden="true"
                              className="go-arrow shrink-0 text-muted-foreground"
                            />
                          </>
                        )}
                      </div>
                    </div>
                    {editable && (
                      <div className="mt-1 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-2">
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
                  </li>
                );
              })}
            </ul>
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
    </div>
  );
}

// A sort toggle with the same SortControl as a table header, as a 44px button.
function SortChip({
  control,
  children,
}: Readonly<{ control: SortControl; children: React.ReactNode }>) {
  return (
    <button
      type="button"
      aria-pressed={control.active}
      onClick={control.onToggle}
      className={cn(
        'inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        control.active ? 'font-medium text-primary' : 'text-muted-foreground',
      )}
    >
      {children}
      {control.active ? (
        <ChevronUp
          size={14}
          className={cn(
            'transition-transform motion-reduce:transition-none',
            control.direction === 'desc' && 'rotate-180',
          )}
        />
      ) : (
        <ArrowUpDown size={12} className="text-slate-300" />
      )}
    </button>
  );
}
