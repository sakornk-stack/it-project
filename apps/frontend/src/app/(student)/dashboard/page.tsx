'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Award, FileCheck2, GraduationCap, Star } from 'lucide-react';
import type { StudentDashboardResponse } from '@eduanalyze-ai/shared-types';
import { fetchOwnStudentProfile, fetchStudentDashboard } from '@/lib/api/dashboard';
import { fetchCurriculum } from '@/lib/api/plo-achievement';
import { useAuth } from '@/lib/auth-context';
import {
  CREDITS_EARNED_NOTE,
  CREDIT_PROGRESS_LABEL,
  GRADUATION_READINESS_LABEL,
  GRADUATION_READINESS_NOTE,
} from '@/lib/credit-labels';
import { buildDashboardSummary } from '@/lib/dashboard-summary';
import { computeGpaChange } from '@/lib/gpa-change';
import { COUNT_UP_MS } from '@/lib/animated-number';
import { useCountUp } from '@/lib/use-count-up';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { Reveal } from '@/components/layout/reveal';
import { RevealOnScroll } from '@/components/layout/reveal-on-scroll';
import { PageLoadError } from '@/components/layout/page-states';
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton';
import { StatCard } from '@/components/dashboard/stat-card';
import { TiltCard } from '@/components/ui/tilt-card';
import { GraduationCelebration } from '@/components/dashboard/graduation-celebration';
import { GpaSparkline } from '@/components/dashboard/gpa-sparkline';
import { GpaChangeBadge } from '@/components/dashboard/gpa-change-badge';
import { CreditCheckerPanel } from '@/components/dashboard/credit-checker-panel';
import { PendingAssessmentPanel } from '@/components/dashboard/pending-assessment-panel';
import { ElectiveProgressPanel } from '@/components/dashboard/elective-progress-panel';
import { CareerFitSummary } from '@/components/dashboard/career-fit-summary';
import { PloOverview } from '@/components/dashboard/plo-overview';
import { ReadinessChecklist } from '@/components/dashboard/readiness-checklist';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Skeleton } from '@/components/ui/skeleton';
import { BAR_TONE_CLASSES } from '@/lib/tone';

export default function DashboardPage() {
  const { user } = useAuth();

  const profileQuery = useQuery({
    queryKey: ['student-profile-me'],
    queryFn: fetchOwnStudentProfile,
  });

  const dashboardQuery = useQuery({
    queryKey: ['student-dashboard', profileQuery.data?.id],
    queryFn: () => fetchStudentDashboard(profileQuery.data!.id),
    enabled: !!profileQuery.data?.id,
  });

  // Same key/fn as /clo-plo-analysis so the cache is shared. A failed load just leaves the
  // threshold unknown (null) and the PLO section shows scores without pass/fail.
  const curriculumId = profileQuery.data?.curriculumId;
  const curriculumQuery = useQuery({
    queryKey: ['curriculum', curriculumId],
    queryFn: () => fetchCurriculum(curriculumId!),
    enabled: !!curriculumId,
  });
  const threshold = curriculumQuery.data?.defaultAchievementThreshold ?? null;

  if (!user) return null;

  const isLoading = profileQuery.isLoading || dashboardQuery.isLoading;

  if (!isLoading && (profileQuery.isError || dashboardQuery.isError || !dashboardQuery.data)) {
    return (
      <DashboardShell studentCode={profileQuery.data?.studentCode ?? ''} fullName={user.fullName}>
        <PageLoadError
          message="ไม่สามารถโหลดข้อมูลแดชบอร์ดได้ กรุณาลองใหม่อีกครั้ง"
          onRetry={() => {
            profileQuery.refetch();
            dashboardQuery.refetch();
          }}
        />
      </DashboardShell>
    );
  }

  const dashboard = dashboardQuery.data;

  return (
    <DashboardShell
      studentCode={profileQuery.data?.studentCode ?? ''}
      fullName={user.fullName}
      skeleton={<DashboardSkeleton />}
      ready={!isLoading}
    >
      {dashboard && (
        <DashboardCards fullName={user.fullName} dashboard={dashboard} threshold={threshold} />
      )}
    </DashboardShell>
  );
}

function DashboardCards({
  fullName,
  dashboard,
  threshold,
}: Readonly<{
  fullName: string;
  dashboard: StudentDashboardResponse;
  threshold: number | null;
}>) {
  const animatedGpa = useCountUp(dashboard.gpa ?? 0, {
    duration: COUNT_UP_MS,
    decimals: 2,
  });
  const animatedCredits = useCountUp(dashboard.creditsEarned, {
    duration: COUNT_UP_MS,
    decimals: 0,
  });
  const animatedProgress = useCountUp(dashboard.curriculumProgressPercent, {
    duration: COUNT_UP_MS,
    decimals: 0,
  });
  const gpaChange = computeGpaChange(dashboard.gpaTrend);
  const isReady = dashboard.graduationReadiness.isReady;
  // When ready, the congratulation is a badge under the title and GPA/credits
  // live in the cards below, so the summary line is not repeated.
  const summary = isReady ? null : buildDashboardSummary(dashboard);
  const creditsPercent =
    dashboard.totalCreditsRequired > 0
      ? Math.min(100, (dashboard.creditsEarned / dashboard.totalCreditsRequired) * 100)
      : 0;
  const creditsOver = Math.max(0, dashboard.creditsEarned - dashboard.totalCreditsRequired);

  return (
    <>
      <GraduationCelebration
        studentProfileId={dashboard.studentProfileId}
        isReady={dashboard.graduationReadiness.isReady}
      />
      <Reveal index={0}>
        <PageHeader
          title={`สวัสดี, ${fullName}`}
          description={summary ?? 'แผนการเรียนวิชาการและตัวชี้วัดความพร้อมของคุณ'}
        />
        {isReady && (
          <Badge tone="success" className="mt-3 gap-1.5 px-3 py-1 text-sm">
            <GraduationCap size={16} aria-hidden="true" />
            ยินดีด้วย! คุณพร้อมสำเร็จการศึกษา
          </Badge>
        )}
      </Reveal>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Reveal index={1}>
          <TiltCard>
            <StatCard
              icon={Star}
              label="เกรดเฉลี่ยสะสม"
              value={dashboard.gpa !== null ? animatedGpa.toFixed(2) : '—'}
              suffix="/ 4.0"
              href="/academic-record"
              footer={
                dashboard.gpaTrend.length >= 2 && (
                  <div className="space-y-2">
                    {gpaChange && <GpaChangeBadge change={gpaChange} />}
                    <GpaSparkline points={dashboard.gpaTrend} />
                  </div>
                )
              }
            />
          </TiltCard>
        </Reveal>
        <Reveal index={2}>
          <StatCard
            icon={FileCheck2}
            label="หน่วยกิตสะสม"
            value={Math.round(animatedCredits)}
            suffix={`/ ${dashboard.totalCreditsRequired}`}
            href="/credit-checker"
            badge={
              dashboard.graduationReadiness.creditsMet
                ? { text: 'ครบตามเกณฑ์', tone: 'positive' }
                : { text: `เหลืออีก ${dashboard.creditsRemaining} หน่วยกิต`, tone: 'neutral' }
            }
            footer={
              <div className="space-y-2">
                <Progress
                  value={creditsPercent}
                  label="หน่วยกิตสะสมเทียบกับเกณฑ์"
                  className="h-1.5"
                  animateOnView
                  barClassName={
                    dashboard.graduationReadiness.creditsMet ? BAR_TONE_CLASSES.success : undefined
                  }
                />
                {creditsOver > 0 && (
                  <p className="text-xs text-muted-foreground">เกินเกณฑ์ {creditsOver} หน่วยกิต</p>
                )}
                <p className="text-xs text-muted-foreground">{CREDITS_EARNED_NOTE}</p>
                {dashboard.onTrackStatus && (
                  <p
                    className={
                      dashboard.onTrackStatus === 'behind'
                        ? 'text-xs font-medium text-amber-600'
                        : 'text-xs font-medium text-emerald-600'
                    }
                  >
                    {dashboard.onTrackStatus === 'behind'
                      ? `ตามหลังแผน — ปีการศึกษานี้ควรมีอย่างน้อย ${dashboard.expectedCredits} หน่วยกิต`
                      : 'ตามแผน'}
                  </p>
                )}
              </div>
            }
          />
        </Reveal>
        <Reveal index={3} className="md:col-span-2 lg:col-span-1">
          <TiltCard>
            <StatCard
              icon={Award}
              label={GRADUATION_READINESS_LABEL}
              href="/learning-path"
              visual={
                <div className="flex w-full items-center gap-4">
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <ProgressRing value={animatedProgress} label={CREDIT_PROGRESS_LABEL} />
                    <span className="text-xs text-muted-foreground">{CREDIT_PROGRESS_LABEL}</span>
                  </div>
                  <ReadinessChecklist readiness={dashboard.graduationReadiness} />
                </div>
              }
              footer={<p className="text-xs text-muted-foreground">{GRADUATION_READINESS_NOTE}</p>}
            />
          </TiltCard>
        </Reveal>
      </div>

      <Reveal index={4}>
        <PageSection title="สิ่งที่ต้องทำต่อ">
          <div className="space-y-4">
            <PendingAssessmentPanel count={dashboard.pendingAssessmentCount} />
            <CreditCheckerPanel courses={dashboard.missingRequiredCourses} />
            <ElectiveProgressPanel categories={dashboard.incompleteElectiveCategories} />
          </div>
        </PageSection>
      </Reveal>

      <RevealOnScroll>
        <PageSection
          title="ผลลัพธ์การเรียนรู้ (PLO)"
          description="ความสำเร็จตามผลลัพธ์การเรียนรู้ระดับหลักสูตร จากผลการเรียนของคุณ"
          actions={
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/aptitude-analysis">ดูสรุปความถนัด</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/clo-plo-analysis">ดูรายละเอียดราย PLO/CLO</Link>
              </Button>
            </div>
          }
        >
          <PloOverview
            radar={dashboard.radar}
            strengths={dashboard.strengths}
            areasForImprovement={dashboard.areasForImprovement}
            threshold={threshold}
          />
        </PageSection>
      </RevealOnScroll>

      <RevealOnScroll>
        <CareerFitSummary />
      </RevealOnScroll>
    </>
  );
}
