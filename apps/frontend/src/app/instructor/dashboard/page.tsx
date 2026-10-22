'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useInstructorCourseTimeline,
  useInstructorDashboard,
  useInstructorYearLevels,
} from '@/lib/instructor-queries';
import { splitTimeline, termLabel } from '@/lib/course-timeline-summary';
import { buildAttentionRows, buildPloLinks, selectFollowUps } from '@/lib/instructor-dashboard';
import { buildInstructorSummary } from '@/lib/instructor-summary';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { CourseAttentionList } from '@/components/instructor/course-attention-list';
import { FollowUpTable } from '@/components/instructor/follow-up-table';
import { InstructorDashboardSkeleton } from '@/components/instructor/instructor-dashboard-skeleton';
import { CARD, CARD_PAD } from '@/components/instructor/instructor-ui';
import { buildPloStack } from '@/lib/plo-clo-chart';
import { PloLinksSection } from '@/components/instructor/plo-links-section';
import { PageHeader } from '@/components/layout/page-header';
import { Reveal } from '@/components/layout/reveal';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

const TITLE = 'ภาพรวมรายวิชาที่สอน';

export default function InstructorDashboardPage() {
  // useSearchParams requires a Suspense boundary in the App Router
  return (
    <Suspense fallback={<InstructorDashboardFallback />}>
      <InstructorDashboardContent />
    </Suspense>
  );
}

// Shown while the URL is being read; the layout's guard has already resolved
// the user by the time this renders.
function InstructorDashboardFallback() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <DashboardShell role="INSTRUCTOR" identityLabel={user.email} fullName={user.fullName}>
      <PageHeader title={TITLE} />
      <InstructorDashboardSkeleton />
    </DashboardShell>
  );
}

// Every course the instructor teaches on one page, in the order of the questions
// an instructor asks: which course to look at first, who to follow up, and which
// PLO each course feeds. One course in depth is the course page's job.
function InstructorDashboardContent() {
  const { user } = useAuth();
  const isInstructor = !!user?.roles.includes('INSTRUCTOR');
  const router = useRouter();
  const searchParams = useSearchParams();

  const dashboardQuery = useInstructorDashboard({ enabled: isInstructor });
  // Only for the latest term in the header; the page works without it.
  const timelineQuery = useInstructorCourseTimeline({ enabled: isInstructor });
  // Only for the year column of the follow-up table (same cache as the year-levels page).
  const yearLevelsQuery = useInstructorYearLevels({ enabled: isInstructor });

  const courses = useMemo(() => dashboardQuery.data?.courses ?? [], [dashboardQuery.data]);
  const summary = useMemo(() => buildInstructorSummary(courses), [courses]);
  const attention = useMemo(() => buildAttentionRows(courses), [courses]);
  const followUps = useMemo(() => selectFollowUps(courses), [courses]);
  const ploLinks = useMemo(() => buildPloLinks(courses), [courses]);
  const ploStack = useMemo(() => buildPloStack(courses), [courses]);
  const latestTerm = useMemo(() => {
    const { latest } = splitTimeline(timelineQuery.data?.years ?? []);
    return latest ? termLabel(latest) : null;
  }, [timelineQuery.data]);
  const yearLevelOf = useMemo(() => {
    if (!yearLevelsQuery.data) return null;
    const map = new Map<string, number>();
    for (const bucket of yearLevelsQuery.data.buckets)
      for (const s of bucket.students) map.set(s.studentProfileId, bucket.yearLevel);
    return (id: string) => map.get(id);
  }, [yearLevelsQuery.data]);

  // The dashboard used to show one course at a time under ?course=; an old link
  // to it now opens that course's own page.
  const courseParam = searchParams.get('course');
  const legacyCourse = courseParam && courses.some((c) => c.courseId === courseParam);
  useEffect(() => {
    if (legacyCourse) router.replace(`/instructor/courses/${courseParam}`);
  }, [legacyCourse, courseParam, router]);

  // The layout's guard renders nothing below it until the user is known.
  if (!user) return null;

  const description = [
    latestTerm ? `ภาคเรียนล่าสุด ${latestTerm}` : null,
    courses.length > 0 ? `สอน ${courses.length} วิชา` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <DashboardShell role="INSTRUCTOR" identityLabel={user.email} fullName={user.fullName}>
      <Reveal index={0}>
        <PageHeader title={TITLE} description={description || 'ทุกวิชาที่คุณสอนในหน้าเดียว'} />
      </Reveal>

      {dashboardQuery.isLoading && <InstructorDashboardSkeleton />}

      {dashboardQuery.isError && (
        <ApiErrorAlert
          message="ไม่สามารถโหลดข้อมูลผลการเรียนของรายวิชาได้ กรุณาลองใหม่อีกครั้ง"
          onRetry={() => void dashboardQuery.refetch()}
        />
      )}

      {dashboardQuery.data && courses.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              illustration="no-data"
              title="ยังไม่มีวิชาที่ได้รับมอบหมายให้สอน"
              description="วิชาจะแสดงที่นี่เมื่อเจ้าหน้าที่มอบหมายให้คุณเป็นอาจารย์ผู้รับผิดชอบ หากคิดว่าควรมีแล้ว ให้ติดต่อเจ้าหน้าที่ที่ดูแลหลักสูตร"
            />
          </CardContent>
        </Card>
      )}

      {courses.length > 0 && !legacyCourse && (
        <>
          {summary && (
            <Reveal index={1}>
              <section aria-label="สรุปภาพรวม" className={cn(CARD, CARD_PAD, 'sm:p-6')}>
                <ul className="space-y-2.5">
                  {summary.map((line) => (
                    <li key={line} className="flex gap-3 text-base leading-relaxed text-primary">
                      <span
                        aria-hidden="true"
                        className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                      />
                      <span className="min-w-0 break-words">{line}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>
          )}

          <Reveal index={2}>
            <CourseAttentionList rows={attention} />
          </Reveal>

          <Reveal index={3}>
            <div className="space-y-3">
              {yearLevelsQuery.isError && (
                <ApiErrorAlert
                  message="โหลดชั้นปีของนิสิตไม่สำเร็จ ส่วนอื่นของหน้านี้ยังแสดงได้ตามปกติ"
                  onRetry={() => void yearLevelsQuery.refetch()}
                />
              )}
              <FollowUpTable
                rows={followUps.rows}
                total={followUps.total}
                people={followUps.people}
                yearLevelOf={yearLevelOf}
              />
            </div>
          </Reveal>

          {ploLinks.length > 0 && (
            <Reveal index={4}>
              <PloLinksSection links={ploLinks} stack={ploStack} />
            </Reveal>
          )}
        </>
      )}
    </DashboardShell>
  );
}
