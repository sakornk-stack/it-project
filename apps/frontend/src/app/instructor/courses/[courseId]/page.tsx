'use client';

import { Suspense, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { courseTermInfo } from '@/lib/course-snapshot';
import { useInstructorCourseTimeline, useInstructorDashboard } from '@/lib/instructor-queries';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { InstructorCourseSkeleton } from '@/components/instructor/instructor-dashboard-skeleton';
import { CourseSelector, type CourseChoice } from '@/components/instructor/course-selector';
import {
  InstructorDetailPanel,
  parseInstructorTab,
  type InstructorTab,
} from '@/components/instructor/instructor-detail-panel';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

export default function InstructorCoursePage({ params }: { params: { courseId: string } }) {
  // useSearchParams requires a Suspense boundary in the App Router
  return (
    <Suspense fallback={<InstructorCourseSkeleton />}>
      <InstructorCourseContent courseId={params.courseId} />
    </Suspense>
  );
}

function InstructorCourseContent({ courseId }: { courseId: string }) {
  const { user } = useAuth();
  const isInstructor = !!user?.roles.includes('INSTRUCTOR');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Same query/key as the overview page: no single-course endpoint exists,
  // and sharing the cache means arriving from the course grid costs no
  // extra request (Gradebook edits invalidate this key too).
  const dashboardQuery = useInstructorDashboard({ enabled: isInstructor });
  // Only for the term under the course name (the hero reads the same cached query).
  const timelineQuery = useInstructorCourseTimeline({ enabled: isInstructor });

  const tabParam = searchParams.get('tab');
  const activeTab = parseInstructorTab(tabParam);
  const studentParam = searchParams.get('student') ?? undefined;

  // tab lives only in the URL — write the resolved default back so a
  // reload lands on the same tab.
  useEffect(() => {
    if (tabParam === activeTab) return;
    selectTab(activeTab, 'replace');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam, activeTab]);

  function selectTab(tab: InstructorTab, mode: 'push' | 'replace' = 'push') {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    params.delete('def');
    params.delete('clo');
    if (tab !== 'students') {
      params.delete('student');
      params.delete('risk');
      params.delete('q');
    }
    router[mode](`${pathname}?${params.toString()}`, { scroll: false });
  }

  // The other courses to switch to; each keeps the tab that is open now.
  const choices = useMemo<CourseChoice[]>(
    () =>
      (dashboardQuery.data?.courses ?? []).map((c) => {
        const info = timelineQuery.data
          ? courseTermInfo(timelineQuery.data.years, c.courseId)
          : null;
        return {
          courseId: c.courseId,
          code: c.code,
          name: c.name,
          meta: [info?.termLabel, info?.curriculum].filter(Boolean).join(' · '),
        };
      }),
    [dashboardQuery.data, timelineQuery.data],
  );

  // Back to where the reader came from; a page opened directly (no history to
  // go back to) falls back to the list of courses.
  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push('/instructor/my-courses');
  }

  // The layout's guard renders nothing below it until the user is known.
  if (!user) return null;

  const course = dashboardQuery.data?.courses.find((c) => c.courseId === courseId) ?? null;

  return (
    <DashboardShell role="INSTRUCTOR" identityLabel={user.email} fullName={user.fullName}>
      <button
        type="button"
        onClick={goBack}
        className="inline-flex min-h-11 w-fit items-center gap-1 self-start text-sm text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        ย้อนกลับ
      </button>

      {dashboardQuery.data && (
        <CourseSelector
          courses={choices}
          activeCourseId={courseId}
          hrefFor={(id) =>
            `/instructor/courses/${id}${tabParam ? `?tab=${encodeURIComponent(tabParam)}` : ''}`
          }
        />
      )}

      {dashboardQuery.isLoading && <InstructorCourseSkeleton withSwitcher />}

      {dashboardQuery.isError && (
        <ApiErrorAlert
          message="ไม่สามารถโหลดข้อมูลรายวิชาได้ กรุณาลองใหม่อีกครั้ง"
          onRetry={() => void dashboardQuery.refetch()}
        />
      )}

      {timelineQuery.isError && (
        <ApiErrorAlert
          message="ไม่สามารถโหลดข้อมูลเทอมของรายวิชาได้ ส่วนอื่นของหน้านี้ยังแสดงได้ตามปกติ"
          onRetry={() => void timelineQuery.refetch()}
        />
      )}

      {dashboardQuery.data && !course && (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              illustration="no-results"
              description="ไม่พบรายวิชานี้ในรายวิชาที่คุณสอน กลับไปเลือกวิชาจากรายการ"
              action={
                <Button asChild variant="outline">
                  <Link href="/instructor/my-courses">ดูรายวิชาที่สอน</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}

      {course && (
        <InstructorDetailPanel
          course={course}
          activeTab={activeTab}
          onTabChange={selectTab}
          isInstructor={isInstructor}
          initialSelectedStudentId={studentParam}
        />
      )}
    </DashboardShell>
  );
}
