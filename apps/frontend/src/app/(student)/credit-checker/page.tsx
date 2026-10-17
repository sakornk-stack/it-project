'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Award, FileCheck2, GraduationCap, Map as MapIcon } from 'lucide-react';
import type { CourseSummary, CreditCheckReport } from '@eduanalyze-ai/shared-types';
import { fetchOwnStudentProfile } from '@/lib/api/dashboard';
import { fetchCreditCheck } from '@/lib/api/credit-checker';
import { useAuth } from '@/lib/auth-context';
import { useCelebrateOnce } from '@/lib/use-celebrate-once';
import { COUNT_UP_MS } from '@/lib/animated-number';
import { useCountUp } from '@/lib/use-count-up';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { Reveal } from '@/components/layout/reveal';
import { RevealOnScroll } from '@/components/layout/reveal-on-scroll';
import { PageLoadError } from '@/components/layout/page-states';
import { StatCard } from '@/components/dashboard/stat-card';
import {
  CategoryProgressList,
  CategoryProgressSummary,
} from '@/components/credit-checker/category-progress-list';
import { MissingCoursesList } from '@/components/credit-checker/missing-courses-list';
import { FailedCoursesList } from '@/components/credit-checker/failed-courses-list';
import { Button } from '@/components/ui/button';
import { ConfettiBurst } from '@/components/ui/confetti-burst';
import { ProgressRing } from '@/components/ui/progress-ring';
import { SuccessStrip } from '@/components/ui/success-strip';
import { ListSkeleton, Skeleton, StatCardsSkeleton } from '@/components/ui/skeleton';

export default function CreditCheckerPage() {
  const { user } = useAuth();

  const profileQuery = useQuery({
    queryKey: ['student-profile-me'],
    queryFn: fetchOwnStudentProfile,
  });
  const studentProfileId = profileQuery.data?.id;

  const reportQuery = useQuery({
    queryKey: ['credit-check', studentProfileId],
    queryFn: () => fetchCreditCheck(studentProfileId!),
    enabled: !!studentProfileId,
  });

  if (!user) return null;

  const skeleton = (
    <>
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <StatCardsSkeleton count={4} className="md:grid-cols-2 lg:grid-cols-4" />
      <ListSkeleton items={4} />
    </>
  );

  if (profileQuery.isLoading || reportQuery.isLoading) {
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

  if (profileQuery.isError || reportQuery.isError || !profileQuery.data || !reportQuery.data) {
    return (
      <DashboardShell studentCode={profileQuery.data?.studentCode ?? ''} fullName={user.fullName}>
        <PageLoadError
          onRetry={() => {
            profileQuery.refetch();
            reportQuery.refetch();
          }}
        />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      studentCode={profileQuery.data.studentCode}
      fullName={user.fullName}
      skeleton={skeleton}
    >
      <CreditCheckReportView report={reportQuery.data} />
    </DashboardShell>
  );
}

function CreditCheckReportView({ report }: Readonly<{ report: CreditCheckReport }>) {
  const failedCourseIds = useMemo(
    () => new Set(report.failedCourses.map((c) => c.courseId)),
    [report.failedCourses],
  );
  const passedCourseIds = useMemo(
    () => new Set(report.passedCourses.map((c) => c.courseId)),
    [report.passedCourses],
  );
  // Prerequisite ids can point at any course in the curriculum, not just
  // the ones already surfaced as missing — union every bucket the report
  // gives us so a lookup never comes back empty.
  const courseById = useMemo(() => {
    const all: CourseSummary[] = [
      ...report.passedCourses,
      ...report.failedCourses,
      ...report.notYetStudiedCourses,
      ...report.missingRequiredCourses,
    ];
    return new Map(all.map((c) => [c.courseId, c]));
  }, [report.passedCourses, report.failedCourses, report.notYetStudiedCourses, report.missingRequiredCourses]);
  const hasFailed = report.failedCourses.length > 0;
  const creditsOverRequired = Math.max(0, report.creditsPassed - report.totalCreditsRequired);
  const celebrateReady = useCelebrateOnce(
    `celebrate:credit-ready:${report.studentProfileId}`,
    report.graduationReadiness.isReady,
  );
  // Capped like the backend's curriculumProgressPercent: earning more than the
  // requirement reads 100%, while the raw creditsPassed stays shown as-is.
  const readinessPercent =
    report.totalCreditsRequired > 0
      ? Math.min(100, (report.creditsPassed / report.totalCreditsRequired) * 100)
      : 0;
  const animatedReadiness = useCountUp(readinessPercent, { duration: COUNT_UP_MS, decimals: 0 });

  return (
    <>
      <PageHeader
        title="ตรวจสอบหน่วยกิต"
        description="ตรวจสอบความคืบหน้าการเรียนเทียบกับโครงสร้างหลักสูตรของคุณแบบละเอียด"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Reveal index={1}>
          <StatCard
            icon={GraduationCap}
            label="ความพร้อมสำเร็จการศึกษา"
            visual={
              <ProgressRing value={animatedReadiness} label="ความพร้อมสำเร็จการศึกษา (ตามหน่วยกิต)" />
            }
          />
        </Reveal>
        <Reveal index={2}>
          <StatCard
            icon={FileCheck2}
            label="หน่วยกิตสะสม"
            value={report.creditsPassed}
            suffix={`/ ${report.totalCreditsRequired}`}
            footer={
              creditsOverRequired > 0 ? (
                <p className="text-xs text-muted-foreground">
                  เกินเกณฑ์ {creditsOverRequired} หน่วยกิต
                </p>
              ) : undefined
            }
          />
        </Reveal>
        <Reveal index={3}>
          <StatCard
            icon={Award}
            label="หน่วยกิตที่เหลือ"
            value={report.creditsRemaining}
            suffix="หน่วยกิต"
          />
        </Reveal>
        <Reveal index={4} className="relative">
          <StatCard
            icon={GraduationCap}
            label="วิชาบังคับที่ยังขาด"
            value={report.graduationReadiness.missingRequiredCount}
            suffix="วิชา"
            badge={
              report.graduationReadiness.isReady
                ? { text: 'วิชาบังคับครบแล้ว', tone: 'positive' }
                : { text: 'ยังขาดวิชาบังคับ', tone: 'neutral' }
            }
          />
          {celebrateReady && <ConfettiBurst delayMs={500} />}
        </Reveal>
      </div>

      <Reveal index={5}>
        {report.missingRequiredCourses.length === 0 && !hasFailed ? (
          <SuccessStrip
            label="ต้องจัดการ"
            message="คุณผ่านรายวิชาบังคับครบตามเกณฑ์แล้ว"
            action={
              <Button asChild variant="ghost" size="sm" className="gap-1.5 self-start sm:self-auto">
                <Link href="/learning-path">
                  <MapIcon size={14} aria-hidden="true" />
                  ไปที่แผนการเรียน
                </Link>
              </Button>
            }
          />
        ) : (
          <PageSection
            title="ต้องจัดการ"
            actions={
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link href="/learning-path">
                  <MapIcon size={14} aria-hidden="true" />
                  ไปที่แผนการเรียน
                </Link>
              </Button>
            }
          >
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
              <div className={hasFailed ? 'lg:col-span-2' : 'lg:col-span-3'}>
                <MissingCoursesList
                  courses={report.missingRequiredCourses}
                  failedCourseIds={failedCourseIds}
                  courseById={courseById}
                  passedCourseIds={passedCourseIds}
                />
              </div>
              {hasFailed && <FailedCoursesList courses={report.failedCourses} />}
            </div>
          </PageSection>
        )}
      </Reveal>

      <RevealOnScroll>
        <PageSection
          title="ความคืบหน้าตามหมวด"
          description={<CategoryProgressSummary categories={report.categoryProgress} />}
        >
          <CategoryProgressList categories={report.categoryProgress} />
        </PageSection>
      </RevealOnScroll>
    </>
  );
}
