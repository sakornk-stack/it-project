'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { CourseListItem, Grade, SemesterGpa, StudentCourseRecord } from '@eduanalyze-ai/shared-types';
import { deleteCourseRecord, updateCourseRecordGrade } from '@/lib/api/academic-record';
import { fetchClos, fetchMyAssessments } from '@/lib/api/course-assessment';
import { GRADE_LABELS, GRADE_OPTIONS } from '@/lib/grade-label';
import { useToast } from '@/lib/toast-context';
import { cn } from '@/lib/utils';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { GradeSelectConfirm } from './grade-select-confirm';
import { SemesterGroupHeader } from './semester-group-header';

interface SemesterGroup {
  id: string;
  label: string;
}

interface RetakeInfo {
  isLatest: boolean;
  previousGrade?: Grade;
}

// Ref callback for the just-added row: the add form and stat cards sit
// above the timeline, so without this the highlight usually plays below
// the fold. 'nearest' leaves the page alone when the row is already visible.
function revealRow(row: HTMLDivElement | null) {
  if (!row) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  row.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
}

export function RecordTimeline({
  records,
  courseMap,
  semesters,
  gpaBySemester,
  highlightRecordId,
  onChanged,
}: {
  records: StudentCourseRecord[];
  courseMap: Map<string, CourseListItem>;
  // Already sorted newest-first — same order used by the GPA trend chart
  // and the add-record form's semester dropdown.
  semesters: SemesterGroup[];
  gpaBySemester: SemesterGpa[];
  // Record to flash green briefly (just created) — parent owns the timer
  // that clears this back to null.
  highlightRecordId?: string | null;
  onChanged: () => void;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Set while a row plays its exit animation, before the delete call
  // actually fires — see the effect below.
  const [exitingRecordId, setExitingRecordId] = useState<string | null>(null);
  const toast = useToast();

  // Which courses can be self-assessed (have CLOs) and which already are.
  // ['clos'] is the key the assessment page uses; ['own-assessments'] is
  // invalidated there on save, so saving refreshes these badges.
  const closQuery = useQuery({ queryKey: ['clos'], queryFn: fetchClos });
  const closLoaded = closQuery.data !== undefined;
  const assessableCourseIds = useMemo(() => {
    const withClo = new Set((closQuery.data ?? []).map((c) => c.courseId));
    return [...new Set(records.map((r) => r.courseId))].filter((id) => withClo.has(id));
  }, [closQuery.data, records]);
  const myAssessmentsQuery = useQuery({
    queryKey: ['own-assessments'],
    queryFn: fetchMyAssessments,
  });
  // Intersect with this timeline's own assessable set so the count can never
  // exceed the total shown next to it.
  const submittedCourseIds = new Set(
    (myAssessmentsQuery.data?.assessments ?? []).map((a) => a.courseId),
  );
  const assessedCourseIds = new Set(
    assessableCourseIds.filter((id) => submittedCourseIds.has(id)),
  );
  const assessmentStatusReady = closLoaded && myAssessmentsQuery.isSuccess;
  const assessmentStatusLoading = closQuery.isLoading || myAssessmentsQuery.isLoading;
  const assessmentStatusFailed = closQuery.isError || myAssessmentsQuery.isError;

  const gpaBySemesterId = new Map(gpaBySemester.map((s) => [s.semesterId, s]));
  const recordsBySemesterId = new Map<string, StudentCourseRecord[]>();
  for (const record of records) {
    const group = recordsBySemesterId.get(record.semesterId) ?? [];
    group.push(record);
    recordsBySemesterId.set(record.semesterId, group);
  }

  // Only render semesters that actually have at least one record — the
  // dropdown's semester list includes future/empty terms too.
  const semestersWithRecords = semesters.filter((s) => recordsBySemesterId.has(s.id));

  // Default-expanded: only the most recent semester with records — the
  // rest start collapsed so the page isn't a wall of past terms on load.
  const [expandedSemesterIds, setExpandedSemesterIds] = useState<Set<string>>(
    () => new Set(semestersWithRecords[0] ? [semestersWithRecords[0].id] : []),
  );

  function toggleSemester(semesterId: string) {
    setExpandedSemesterIds((prev) => {
      const next = new Set(prev);
      if (next.has(semesterId)) next.delete(semesterId);
      else next.add(semesterId);
      return next;
    });
  }

  // If the just-created record landed in a semester that's still
  // collapsed (anything other than the most recent term), force it open
  // — otherwise the highlight flash would happen on a hidden row and the
  // user would never see it.
  useEffect(() => {
    if (!highlightRecordId) return;
    const record = records.find((r) => r.id === highlightRecordId);
    if (!record) return;
    setExpandedSemesterIds((prev) => {
      if (prev.has(record.semesterId)) return prev;
      const next = new Set(prev);
      next.add(record.semesterId);
      return next;
    });
  }, [highlightRecordId, records]);

  // Retake detection — no backend field for this; a retake is simply a
  // courseId appearing in more than one record (the unique constraint is
  // (studentProfileId, courseId, semesterId), so both the original and
  // the retake attempt stay isActive:true side by side). semesters is
  // already sorted newest-first, so its index doubles as recency rank.
  const semesterIndexById = new Map(semesters.map((s, i) => [s.id, i]));
  const recordsByCourseId = new Map<string, StudentCourseRecord[]>();
  for (const record of records) {
    const group = recordsByCourseId.get(record.courseId) ?? [];
    group.push(record);
    recordsByCourseId.set(record.courseId, group);
  }
  const retakeInfoByRecordId = new Map<string, RetakeInfo>();
  for (const group of recordsByCourseId.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort(
      (a, b) => (semesterIndexById.get(a.semesterId) ?? 0) - (semesterIndexById.get(b.semesterId) ?? 0),
    );
    sorted.forEach((record, i) => {
      retakeInfoByRecordId.set(record.id, {
        isLatest: i === 0,
        previousGrade: i === 0 ? sorted[1]?.grade : undefined,
      });
    });
  }

  async function handleGradeChange(id: string, grade: string) {
    setBusyId(id);
    try {
      await updateCourseRecordGrade(id, { grade: grade as StudentCourseRecord['grade'] });
      onChanged();
      toast.success('บันทึกเกรดแล้ว');
    } catch {
      toast.error('บันทึกเกรดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setBusyId(null);
    }
  }

  function handleDelete(id: string) {
    // Play the exit animation first — the actual delete + onChanged()
    // (which invalidates the query and would otherwise make the row
    // vanish instantly) happens after the animation finishes, in the
    // effect below.
    setConfirmingId(null);
    setExitingRecordId(id);
  }

  useEffect(() => {
    if (!exitingRecordId) return;
    const id = exitingRecordId;
    // Matches duration-500 above — the row's slide/fade-out class.
    const timer = setTimeout(async () => {
      setBusyId(id);
      try {
        await deleteCourseRecord(id);
        onChanged();
        toast.success('ลบรายวิชาแล้ว');
      } catch {
        // The row already animated away, and clearing exitingRecordId below
        // snaps it back into the list — without this the reappearance looks
        // like a glitch rather than a failed delete.
        toast.error('ลบรายวิชาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      } finally {
        setBusyId(null);
        setExitingRecordId(null);
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exitingRecordId]);

  return (
    <Card>
      <CardContent className="pt-6">
        {semestersWithRecords.length === 0 && (
          <p className="py-6 text-center text-muted-foreground">ยังไม่มีรายวิชาที่บันทึกไว้</p>
        )}

        {semestersWithRecords.length > 0 && assessmentStatusFailed && (
          <div className="mb-4">
            <ApiErrorAlert
              message="โหลดสถานะการประเมินตนเองไม่สำเร็จ ปุ่มประเมินวิชายังใช้งานได้ แต่ยอดสรุปอาจไม่ครบ"
              onRetry={() => {
                void closQuery.refetch();
                void myAssessmentsQuery.refetch();
              }}
            />
          </div>
        )}

        {semestersWithRecords.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            {assessmentStatusLoading ? (
              <div role="status">
                <span className="sr-only">กำลังโหลดสถานะการประเมินตนเอง</span>
                <Skeleton className="h-4 w-56" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {assessmentStatusReady && assessableCourseIds.length > 0
                  ? `ประเมินตนเองตาม CLO แล้ว ${assessedCourseIds.size} จาก ${assessableCourseIds.length} วิชาที่มี CLO ให้ประเมิน`
                  : ' '}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setExpandedSemesterIds(new Set(semestersWithRecords.map((s) => s.id)))}
              >
                ขยายทุกภาคเรียน
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setExpandedSemesterIds(new Set())}
              >
                ยุบทั้งหมด
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-8">
          {semestersWithRecords.map((semester, index) => {
            const semesterRecords = recordsBySemesterId.get(semester.id) ?? [];
            const semesterGpa = gpaBySemesterId.get(semester.id);
            const isExpanded = expandedSemesterIds.has(semester.id);

            // "Previous" = chronologically earlier = further along this
            // newest-first array (index+1, not index-1). Walk past any
            // term whose gpa is null (WISU-only, nothing to compare)
            // instead of stopping there, so a single gap-term doesn't
            // hide a real comparison against the term before it.
            let previousGpa: number | null = null;
            for (let i = index + 1; i < semestersWithRecords.length; i++) {
              const candidate = gpaBySemesterId.get(semestersWithRecords[i].id)?.gpa;
              if (candidate != null) {
                previousGpa = candidate;
                break;
              }
            }

            return (
              <div key={semester.id} className="relative border-l-2 border-slate-100 pl-6">
                <span className="absolute -left-[7px] top-0 h-3 w-3 rounded-full border-2 border-primary bg-background" />

                <SemesterGroupHeader
                  label={semester.label}
                  gpa={semesterGpa?.gpa ?? null}
                  previousGpa={previousGpa}
                  creditsCounted={semesterGpa?.creditsCounted ?? 0}
                  isExpanded={isExpanded}
                  onToggle={() => toggleSemester(semester.id)}
                />

                {isExpanded && (
                  <div className="space-y-2">
                    {semesterRecords.map((record) => {
                      const course = courseMap.get(record.courseId);
                      const isBusy = busyId === record.id;
                      const retake = retakeInfoByRecordId.get(record.id);
                      const isExiting = exitingRecordId === record.id;
                      const isHighlighted = highlightRecordId === record.id;

                      return (
                        <div
                          key={record.id}
                          ref={isHighlighted ? revealRow : undefined}
                          className={cn(
                            'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3 transition-colors duration-500',
                            isExiting && 'animate-out fade-out-0 slide-out-to-top-4 duration-500',
                            isHighlighted && 'bg-emerald-50',
                          )}
                        >
                          {/* basis-48 + wrap (not truncate): on narrow screens the
                              controls drop below the name instead of the name's
                              nowrap width forcing the whole page wider. */}
                          <div className="min-w-0 grow basis-48">
                            <p className="text-sm font-medium text-primary">
                              {course?.code ?? '—'} — {course?.name ?? '—'}
                            </p>
                            <p className="text-xs text-muted-foreground">{record.credits} หน่วยกิต</p>
                            {retake?.isLatest && retake.previousGrade && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                เกรดเดิม{' '}
                                <span className="line-through">{GRADE_LABELS[retake.previousGrade]}</span>
                                {' → '}
                                {GRADE_LABELS[record.grade]}
                              </p>
                            )}
                          </div>

                          {retake && (
                            <span className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                              ลงซ้ำ
                            </span>
                          )}

                          {assessedCourseIds.has(record.courseId) && (
                            <Badge tone="success">ประเมินแล้ว</Badge>
                          )}
                          {assessmentStatusReady &&
                            assessableCourseIds.includes(record.courseId) &&
                            !assessedCourseIds.has(record.courseId) && (
                              <Badge tone="neutral">ยังไม่ประเมิน</Badge>
                            )}

                          <GradeSelectConfirm
                            value={record.grade}
                            subject={`${course?.code ?? 'วิชานี้'}`}
                            disabled={isBusy}
                            onConfirm={(grade) => handleGradeChange(record.id, grade)}
                          />

                          {confirmingId === record.id ? (
                            <div className="flex shrink-0 gap-2">
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={isBusy}
                                aria-label={`ยืนยันลบผลการเรียน ${course?.code ?? ''}`}
                                onClick={() => handleDelete(record.id)}
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
                            </div>
                          ) : (
                            <div className="flex shrink-0 gap-3">
                              {(!closLoaded || assessableCourseIds.includes(record.courseId)) && (
                                <Link href={`/course-assessment/${record.courseId}`}>
                                  <Button
                                    type="button"
                                    variant={assessedCourseIds.has(record.courseId) ? 'outline' : 'default'}
                                    size="sm"
                                  >
                                    {assessedCourseIds.has(record.courseId)
                                      ? 'แก้ไขการประเมิน'
                                      : 'ประเมินวิชานี้'}
                                  </Button>
                                </Link>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                aria-label={`ลบผลการเรียน ${course?.code ?? ''}`}
                                onClick={() => setConfirmingId(record.id)}
                              >
                                ลบ
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
