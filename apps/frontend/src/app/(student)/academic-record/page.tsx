'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GraduationCap, FileCheck2, Info, Plus, Star, X } from 'lucide-react';
import { fetchOwnStudentProfile } from '@/lib/api/dashboard';
import {
  fetchAcademicYears,
  fetchCourses,
  fetchMyCourseRecords,
  fetchMyGpa,
  fetchSemesters,
} from '@/lib/api/academic-record';
import { formatSemesterLabel } from '@/lib/grade-label';
import { gpaColorClassName } from '@/lib/gpa-color';
import { COUNT_UP_MS } from '@/lib/animated-number';
import { useCountUp } from '@/lib/use-count-up';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { Reveal } from '@/components/layout/reveal';
import { PageLoadError } from '@/components/layout/page-states';
import { StatCard } from '@/components/dashboard/stat-card';
import { AddRecordForm } from '@/components/academic-record/add-record-form';
import { RecordTimeline } from '@/components/academic-record/record-timeline';
import { Button } from '@/components/ui/button';
import { ListSkeleton, Skeleton, StatCardsSkeleton } from '@/components/ui/skeleton';

const TERM_ORDER: Record<string, number> = { FIRST: 0, SECOND: 1, SUMMER: 2 };

export default function AcademicRecordPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['student-profile-me'],
    queryFn: fetchOwnStudentProfile,
  });
  const studentProfileId = profileQuery.data?.id;

  const recordsQuery = useQuery({
    queryKey: ['my-course-records'],
    queryFn: fetchMyCourseRecords,
    enabled: !!studentProfileId,
  });
  const gpaQuery = useQuery({
    queryKey: ['my-gpa', studentProfileId],
    queryFn: () => fetchMyGpa(studentProfileId!),
    enabled: !!studentProfileId,
  });
  const coursesQuery = useQuery({ queryKey: ['courses'], queryFn: fetchCourses, enabled: !!studentProfileId });
  const academicYearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: fetchAcademicYears,
    enabled: !!studentProfileId,
  });
  const semestersQuery = useQuery({
    queryKey: ['semesters'],
    queryFn: fetchSemesters,
    enabled: !!studentProfileId,
  });

  const courseMap = useMemo(() => {
    const map = new Map((coursesQuery.data ?? []).map((c) => [c.id, c]));
    return map;
  }, [coursesQuery.data]);

  const filteredCourses = useMemo(() => {
    if (!profileQuery.data) return [];
    return (coursesQuery.data ?? [])
      .filter((c) => c.curriculumId === profileQuery.data.curriculumId)
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [coursesQuery.data, profileQuery.data]);

  const yearById = useMemo(
    () => new Map((academicYearsQuery.data ?? []).map((y) => [y.id, y.year])),
    [academicYearsQuery.data],
  );

  const joinedSemesters = useMemo(() => {
    return (semestersQuery.data ?? [])
      .map((s) => ({
        id: s.id,
        year: yearById.get(s.academicYearId),
        term: s.term,
        label: formatSemesterLabel(s.term, yearById.get(s.academicYearId)),
      }))
      .sort((a, b) => {
        const yearDiff = (b.year ?? 0) - (a.year ?? 0);
        if (yearDiff !== 0) return yearDiff;
        return TERM_ORDER[b.term] - TERM_ORDER[a.term];
      });
  }, [semestersQuery.data, yearById]);

  const gpa = gpaQuery.data;

  // Called unconditionally (before the loading/error early-returns below)
  // so Rules of Hooks holds — target defaults to 0 while gpa hasn't
  // loaded yet, then flips to the real number once gpaQuery resolves,
  // which is exactly what triggers the 0→target count-up (same pattern
  // Dashboard F2 uses, just without needing a separate child component
  // here since this page's StatCard trio is fixed, not looped).
  const animatedGpa = useCountUp(gpa?.gpa ?? 0, {
    duration: COUNT_UP_MS,
    decimals: 2,
    easing: 'elastic',
    clampMin: 0,
    clampMax: 4,
  });
  const animatedCredits = useCountUp(gpa?.creditsCounted ?? 0, {
    duration: COUNT_UP_MS,
    decimals: 0,
  });
  const animatedCourseCount = useCountUp(gpa?.courseCount ?? 0, {
    duration: COUNT_UP_MS,
    decimals: 0,
  });

  function refetchAll() {
    queryClient.invalidateQueries({ queryKey: ['my-course-records'] });
    queryClient.invalidateQueries({ queryKey: ['my-gpa', studentProfileId] });
  }

  // Highlight the just-added record for a moment — cleared automatically
  // so the caller never has to remember to reset it. 2000ms hold before
  // the transition-colors duration-500 fade starts (same duration unit
  // as every other animation on this page).
  const [highlightRecordId, setHighlightRecordId] = useState<string | null>(null);
  useEffect(() => {
    if (!highlightRecordId) return;
    const timer = setTimeout(() => setHighlightRecordId(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightRecordId]);

  // null = the student hasn't touched the toggle yet, in which case the form
  // starts open only when there is nothing recorded (adding is then the
  // only thing to do on this page). An explicit open also autofocuses it.
  const [addFormToggle, setAddFormToggle] = useState<boolean | null>(null);
  const addFormId = useId();
  const [showCreditsNote, setShowCreditsNote] = useState(false);
  const creditsNoteId = useId();
  const addFormToggleRef = useRef<HTMLButtonElement>(null);

  function closeAddForm() {
    setAddFormToggle(false);
    // The cancel button unmounts with the form — hand focus back to the
    // toggle rather than letting it fall to <body>.
    addFormToggleRef.current?.focus();
  }

  function handleRecordsCreated(newRecordIds: string[]) {
    refetchAll();
    setHighlightRecordId(newRecordIds[newRecordIds.length - 1] ?? null);
  }

  if (!user) return null;

  const isLoading =
    profileQuery.isLoading ||
    recordsQuery.isLoading ||
    gpaQuery.isLoading ||
    coursesQuery.isLoading ||
    academicYearsQuery.isLoading ||
    semestersQuery.isLoading;

  const skeleton = (
    <>
      <div className="space-y-2">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <StatCardsSkeleton count={3} />
      <ListSkeleton items={5} />
    </>
  );

  if (isLoading) {
    return (
      <DashboardShell
        studentCode={profileQuery.data?.studentCode ?? ''}
        fullName={user.fullName}
        skeleton={skeleton}
        ready={false}
      >
        {null}
      </DashboardShell>
    );
  }

  if (
    profileQuery.isError ||
    recordsQuery.isError ||
    gpaQuery.isError ||
    coursesQuery.isError ||
    academicYearsQuery.isError ||
    semestersQuery.isError ||
    !profileQuery.data
  ) {
    return (
      <DashboardShell studentCode={profileQuery.data?.studentCode ?? ''} fullName={user.fullName}>
        <PageLoadError
          onRetry={() => {
            profileQuery.refetch();
            recordsQuery.refetch();
            gpaQuery.refetch();
            coursesQuery.refetch();
            academicYearsQuery.refetch();
            semestersQuery.refetch();
          }}
        />
      </DashboardShell>
    );
  }

  const records = recordsQuery.data ?? [];
  const isAddFormOpen = addFormToggle ?? records.length === 0;

  return (
    <DashboardShell
      studentCode={profileQuery.data.studentCode}
      fullName={user.fullName}
      skeleton={skeleton}
    >
      <PageHeader
        title="การติดตามผลการเรียน"
        description="บันทึกและจัดการรายวิชาที่นิสิตเรียนไปแล้ว"
        actions={
          <Button
            ref={addFormToggleRef}
            type="button"
            variant={isAddFormOpen ? 'outline' : 'default'}
            className="gap-1.5"
            onClick={() => setAddFormToggle(!isAddFormOpen)}
            aria-expanded={isAddFormOpen}
            aria-controls={addFormId}
          >
            {isAddFormOpen ? <X size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            {isAddFormOpen ? 'ปิดฟอร์ม' : 'เพิ่มรายวิชา'}
          </Button>
        }
      />

      {isAddFormOpen && (
        <div id={addFormId} className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
          <AddRecordForm
            studentProfileId={profileQuery.data.id}
            courses={filteredCourses}
            semesterOptions={joinedSemesters}
            recorded={records.filter((r) => r.isActive)}
            onCreated={handleRecordsCreated}
            onCancel={closeAddForm}
            autoFocus={addFormToggle === true}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Reveal index={1}>
          <StatCard
            icon={Star}
            label="เกรดเฉลี่ยสะสม"
            value={
              gpa?.gpa != null ? (
                <span className={gpaColorClassName(gpa.gpa)}>{animatedGpa.toFixed(2)}</span>
              ) : (
                '—'
              )
            }
            suffix="/ 4.0"
          />
        </Reveal>
        <Reveal index={2}>
          <StatCard
            icon={FileCheck2}
            label="หน่วยกิตที่นับ GPA"
            value={Math.round(animatedCredits)}
            footer={
              <div className="text-xs text-muted-foreground">
                <p className="flex items-center gap-1">
                  รวมวิชาที่ได้ F เพราะมีผลต่อเกรดเฉลี่ย
                  <button
                    type="button"
                    aria-label="คำอธิบายหน่วยกิตที่นับ GPA"
                    aria-expanded={showCreditsNote}
                    aria-controls={creditsNoteId}
                    onClick={() => setShowCreditsNote((v) => !v)}
                    className="-my-3 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <Info size={14} aria-hidden="true" />
                  </button>
                </p>
                {showCreditsNote && (
                  <p id={creditsNoteId} className="mt-1">
                    รวมวิชาที่สอบตก (F) ด้วย เพราะมีผลต่อเกรดเฉลี่ย — ไม่เหมือน
                    &quot;หน่วยกิตสะสม&quot; ที่นับเฉพาะวิชาที่ผ่าน (รวม S) ไม่นับวิชาที่ได้ F, U, W หรือ I
                  </p>
                )}
              </div>
            }
          />
        </Reveal>
        <Reveal index={3}>
          <StatCard icon={GraduationCap} label="จำนวนวิชาที่บันทึก" value={Math.round(animatedCourseCount)} />
        </Reveal>
      </div>

      <Reveal index={4}>
        <PageSection
          title="รายวิชาที่บันทึกไว้"
          description="เรียงจากภาคเรียนล่าสุด — กดชื่อภาคเรียนเพื่อพับหรือเปิดดูรายวิชา"
        >
          <RecordTimeline
            records={records}
            courseMap={courseMap}
            semesters={joinedSemesters}
            gpaBySemester={gpa?.bySemester ?? []}
            highlightRecordId={highlightRecordId}
            onChanged={refetchAll}
          />
        </PageSection>
      </Reveal>
    </DashboardShell>
  );
}
