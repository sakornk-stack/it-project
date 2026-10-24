'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ArrowLeft, Ban, BookOpenCheck, GraduationCap, Network, Star } from 'lucide-react';
import type { AdviseeCourseRecord, AdviseeDetail } from '@eduanalyze-ai/shared-types';
import { fetchAdvisee } from '@/lib/api/advisor';
import { useAuth } from '@/lib/auth-context';
import {
  CREDITS_EARNED_NOTE,
  GRADUATION_READINESS_LABEL,
  GRADUATION_READINESS_NOTE,
} from '@/lib/credit-labels';
import { formatSemesterLabel } from '@/lib/grade-label';
import { gpaColorClassName } from '@/lib/gpa-color';
import { BADGE_TONE_CLASSES } from '@/lib/tone';
import { cn } from '@/lib/utils';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { StatCard } from '@/components/dashboard/stat-card';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { PageLoadError } from '@/components/layout/page-states';
import { Reveal } from '@/components/layout/reveal';
import { CategoryProgressList } from '@/components/credit-checker/category-progress-list';
import { FailedCoursesList } from '@/components/credit-checker/failed-courses-list';
import { NoPloNotice } from '@/components/clo-plo-analysis/no-plo-notice';
import { PloCard } from '@/components/clo-plo-analysis/plo-card';
import { GradeChip } from '@/components/instructor/grade-chip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton, StatCardsSkeleton, TableSkeleton } from '@/components/ui/skeleton';

const TERM_RANK: Record<string, number> = { FIRST: 1, SECOND: 2, SUMMER: 3 };

interface TermGroup {
  semesterId: string;
  label: string;
  gpa: number | null;
  records: AdviseeCourseRecord[];
}

// One advisee, read-only: the same GPA, credit check and PLO figures the student
// sees on their own pages (one API call; a student the caller does not advise is a 404).
export default function InstructorAdviseePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['advisee', id],
    queryFn: () => fetchAdvisee(id),
    enabled: !!user?.roles.includes('INSTRUCTOR'),
    retry: (count, error) => !(isAxiosError(error) && error.response?.status === 404) && count < 2,
  });

  if (!user) return null;
  const notFound = isAxiosError(query.error) && query.error.response?.status === 404;

  return (
    <DashboardShell role="INSTRUCTOR" identityLabel={user.email} fullName={user.fullName}>
      <Link
        href="/instructor/advisees"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft aria-hidden="true" size={14} />
        กลับไปนิสิตในที่ปรึกษา
      </Link>

      {query.isLoading && (
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>
          <StatCardsSkeleton count={4} className="sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-4" />
          <Card>
            <CardContent className="pt-6">
              <TableSkeleton cols={4} rows={4} />
            </CardContent>
          </Card>
        </div>
      )}
      {query.isError && (
        <PageLoadError
          message={notFound ? 'ไม่พบนิสิตคนนี้ในรายชื่อที่ปรึกษาของคุณ' : undefined}
          onRetry={() => void query.refetch()}
        />
      )}
      {query.data && <AdviseeContent detail={query.data} />}
    </DashboardShell>
  );
}

function AdviseeContent({ detail }: Readonly<{ detail: AdviseeDetail }>) {
  const { student, gpa, records, creditCheck, ploAchievement, ploThreshold } = detail;
  const [expandedPloIds, setExpandedPloIds] = useState<ReadonlySet<string>>(new Set());

  // Newest term first; each term with its own GPA from the same report.
  const terms = useMemo<TermGroup[]>(() => {
    const gpaBySemester = new Map(gpa.bySemester.map((s) => [s.semesterId, s.gpa]));
    const groups = new Map<string, TermGroup>();
    for (const record of records) {
      let group = groups.get(record.semesterId);
      if (!group) {
        group = {
          semesterId: record.semesterId,
          label: formatSemesterLabel(record.semesterTerm, record.academicYear),
          gpa: gpaBySemester.get(record.semesterId) ?? null,
          records: [],
        };
        groups.set(record.semesterId, group);
      }
      group.records.push(record);
    }
    const order = (g: TermGroup) => {
      const first = g.records[0];
      return first.academicYear * 10 + (TERM_RANK[first.semesterTerm] ?? 0);
    };
    return [...groups.values()].sort((a, b) => order(b) - order(a));
  }, [gpa.bySemester, records]);

  // Lowest first, no data last: what needs a talk comes first.
  const plos = useMemo(
    () =>
      [...ploAchievement.radar].sort((a, b) => {
        if (a.value === null && b.value === null) return 0;
        if (a.value === null) return 1;
        if (b.value === null) return -1;
        return a.value - b.value;
      }),
    [ploAchievement.radar],
  );
  const plosWithData = plos.filter((p) => p.value !== null);
  const plosAchieved = plosWithData.filter((p) => (p.value ?? 0) >= ploThreshold).length;

  const handleExpandedChange = (ploId: string, expanded: boolean) =>
    setExpandedPloIds((prev) => {
      const next = new Set(prev);
      if (expanded) next.add(ploId);
      else next.delete(ploId);
      return next;
    });

  return (
    <>
      <Reveal index={0}>
        <PageHeader
          title={student.fullName}
          description={`${student.studentCode} · ${student.programName} หลักสูตร ${student.curriculumVersion} · เข้าปี ${student.admissionYear}`}
        />
        {!student.isActive && (
          <p
            role="note"
            className={cn(
              'mt-3 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm',
              BADGE_TONE_CLASSES.neutral,
            )}
          >
            <Ban aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>บัญชีของนิสิตคนนี้ถูกระงับอยู่ นิสิตเข้าสู่ระบบไม่ได้</span>
          </p>
        )}
      </Reveal>

      <Reveal index={1}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            dense
            interactive={false}
            icon={Star}
            tone="primary"
            label="GPA สะสม"
            value={
              <span className={gpaColorClassName(gpa.gpa)}>
                {gpa.gpa === null ? '—' : gpa.gpa.toFixed(2)}
              </span>
            }
            caption={`${gpa.creditsCounted} หน่วยกิตที่นับ GPA`}
          />
          <StatCard
            dense
            interactive={false}
            icon={BookOpenCheck}
            tone="primary"
            label="หน่วยกิตสะสม"
            value={`${creditCheck.creditsAccumulated} / ${creditCheck.totalCreditsRequired}`}
            caption={CREDITS_EARNED_NOTE}
          />
          <StatCard
            dense
            interactive={false}
            icon={GraduationCap}
            tone={creditCheck.graduationReadiness.isReady ? 'success' : 'neutral'}
            label={GRADUATION_READINESS_LABEL}
            value={creditCheck.graduationReadiness.isReady ? 'พร้อม' : 'ยังไม่พร้อม'}
            caption={GRADUATION_READINESS_NOTE}
          />
          <StatCard
            dense
            interactive={false}
            icon={Network}
            tone="neutral"
            label="PLO ที่ถึงเกณฑ์"
            value={plos.length === 0 ? '—' : `${plosAchieved} / ${plos.length}`}
            caption={`เกณฑ์ ${ploThreshold}% · มีข้อมูล ${plosWithData.length} ข้อ`}
          />
        </div>
      </Reveal>

      <Reveal index={2}>
        <PageSection title="ผลการเรียนรายภาคเรียน">
          {terms.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <EmptyState illustration="no-data" description="ยังไม่มีผลการเรียน" />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {terms.map((term) => (
                <Card key={term.semesterId}>
                  <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2 space-y-0">
                    <CardTitle>{term.label}</CardTitle>
                    <span className="text-sm text-muted-foreground">
                      GPA ภาคเรียน{' '}
                      <span
                        className={cn('font-semibold tabular-nums', gpaColorClassName(term.gpa))}
                      >
                        {term.gpa === null ? '—' : term.gpa.toFixed(2)}
                      </span>
                    </span>
                  </CardHeader>
                  <CardContent>
                    {/* relative: GradeChip's sr-only text is absolute and would otherwise
                        escape the scroll box and widen the page on a phone. */}
                    <DataTable wrapperClassName="relative">
                      <thead>
                        <tr>
                          <th>รหัสวิชา</th>
                          <th>ชื่อวิชา</th>
                          <th className="data-num">หน่วยกิต</th>
                          <th>เกรด</th>
                        </tr>
                      </thead>
                      <tbody>
                        {term.records.map((record) => (
                          <tr key={record.id}>
                            <td className="font-mono text-xs">{record.course.code}</td>
                            <td className="data-truncate" title={record.course.name}>
                              {record.course.name}
                            </td>
                            <td className="data-num">{record.credits}</td>
                            <td>
                              <GradeChip grade={record.grade} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </DataTable>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </PageSection>
      </Reveal>

      <Reveal index={3}>
        <PageSection title="ความคืบหน้าตามหมวดวิชา">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div
              className={cn(
                'space-y-4',
                creditCheck.failedCourses.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3',
              )}
            >
              <CategoryProgressList categories={creditCheck.categoryProgress} />
              {creditCheck.missingRequiredCourses.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      วิชาบังคับที่ยังไม่ผ่าน ({creditCheck.missingRequiredCourses.length} วิชา)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                      {creditCheck.missingRequiredCourses.map((course) => (
                        <li key={course.courseId} className="course-name-break min-w-0">
                          <span className="font-mono text-xs text-muted-foreground">
                            {course.code}
                          </span>{' '}
                          <span className="text-primary">{course.name}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
            <FailedCoursesList courses={creditCheck.failedCourses} />
          </div>
        </PageSection>
      </Reveal>

      <Reveal index={4}>
        <PageSection
          title="ผลลัพธ์การเรียนรู้ระดับหลักสูตร (PLO)"
          description={`เรียงจาก PLO ที่ได้น้อยที่สุด · เกณฑ์ผ่าน ${ploThreshold}%`}
        >
          {plos.length === 0 ? (
            <NoPloNotice />
          ) : (
            <div
              className={cn(
                'grid grid-cols-1 gap-4 lg:grid-cols-2',
                expandedPloIds.size > 0 && 'items-start',
              )}
            >
              {plos.map((plo) => (
                <PloCard
                  key={plo.ploId}
                  plo={plo}
                  description={null}
                  isAchieved={plo.value !== null && plo.value >= ploThreshold}
                  threshold={ploThreshold}
                  expanded={expandedPloIds.has(plo.ploId)}
                  onExpandedChange={handleExpandedChange}
                />
              ))}
            </div>
          )}
        </PageSection>
      </Reveal>
    </>
  );
}
