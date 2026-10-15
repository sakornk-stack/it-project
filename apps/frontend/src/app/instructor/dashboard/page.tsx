'use client';

import { Suspense, useMemo, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchInstructorCourseTimeline, fetchInstructorDashboard } from '@/lib/api/instructor';
import { courseTermInfo } from '@/lib/course-snapshot';
import { advancePlay, INITIAL_PLAY } from '@/lib/count-up-policy';
import { useAuth } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { RequireRole } from '@/components/auth/require-role';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import Link from 'next/link';
import { CourseHero } from '@/components/instructor/course-hero';
import { CourseOverview } from '@/components/instructor/course-overview';
import { TEXT_PAGE } from '@/components/instructor/instructor-ui';
import { CourseSelector, type CourseChoice } from '@/components/instructor/course-selector';
import { InstructorDashboardSkeleton } from '@/components/instructor/instructor-dashboard-skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { Reveal } from '@/components/layout/reveal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { CountUpPolicy } from '@/components/ui/count-up-policy';
import { Skeleton } from '@/components/ui/skeleton';

export default function InstructorDashboardPage() {
  return (
    <ProtectedRoute>
      {/* useSearchParams requires a Suspense boundary in the App Router */}
      <Suspense fallback={null}>
        <InstructorDashboardContent />
      </Suspense>
    </ProtectedRoute>
  );
}

function InstructorDashboardContent() {
  const { user } = useAuth();
  const isInstructor = !!user?.roles.includes('INSTRUCTOR');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dashboardQuery = useQuery({
    queryKey: ['instructor-dashboard'],
    queryFn: fetchInstructorDashboard,
    enabled: isInstructor,
  });
  // Only for the term and curriculum under each course name; the page works
  // without it.
  const timelineQuery = useQuery({
    queryKey: ['instructor-course-timeline'],
    queryFn: fetchInstructorCourseTimeline,
    enabled: isInstructor,
  });

  const courses = useMemo(() => dashboardQuery.data?.courses ?? [], [dashboardQuery.data]);
  const choices = useMemo<CourseChoice[]>(
    () =>
      courses.map((c) => {
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
    [courses, timelineQuery.data],
  );

  // The chosen course lives in ?course=; a missing or unknown id falls back to
  // the first course, so a reload or a shared link lands on the same view.
  const courseParam = searchParams.get('course');
  const selected = courses.find((c) => c.courseId === courseParam) ?? courses[0] ?? null;

  // The figures count up for the course shown when the page opens; switching
  // course (or coming back to the first one) shows the values straight away.
  const play = useRef(INITIAL_PLAY);
  play.current = advancePlay(play.current, selected?.courseId ?? null);

  function selectCourse(courseId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('course', courseId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-3">
          <Skeleton className="mx-auto h-10 w-10 rounded-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    );
  }

  return (
    <RequireRole role="INSTRUCTOR">
      <DashboardShell role="INSTRUCTOR" identityLabel={user.email} fullName={user.fullName}>
        <Reveal index={0}>
          <div className="space-y-2">
            <nav
              aria-label="เส้นทางหน้า"
              className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
            >
              <Link
                href="/instructor/my-courses"
                className="inline-flex min-h-11 items-center hover:text-primary"
              >
                รายวิชาที่สอน
              </Link>
            </nav>
            <PageHeader
              title="ภาพรวมผลการเรียน"
              description="ผลการเรียนของรายวิชาที่คุณสอน ดูทีละวิชา"
              titleClassName={TEXT_PAGE}
            />
          </div>
        </Reveal>

        {dashboardQuery.isLoading && <InstructorDashboardSkeleton />}

        {dashboardQuery.isError && (
          <Alert variant="destructive">
            <AlertDescription>ไม่สามารถโหลดข้อมูลแดชบอร์ดได้ กรุณาลองใหม่อีกครั้ง</AlertDescription>
          </Alert>
        )}

        {dashboardQuery.data && courses.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <EmptyState
                illustration="no-data"
                description="ยังไม่มีวิชาที่ได้รับมอบหมายให้คุณสอน วิชาจะแสดงที่นี่เมื่อเจ้าหน้าที่มอบหมายให้คุณเป็นอาจารย์ผู้รับผิดชอบ หากคิดว่าควรมีแล้ว ให้ติดต่อเจ้าหน้าที่ที่ดูแลหลักสูตร"
              />
            </CardContent>
          </Card>
        )}

        {selected && (
          <Reveal index={1}>
            <div className="space-y-6">
              <CourseHero
                course={selected}
                heading="h2"
                detailHref={`/instructor/courses/${selected.courseId}`}
                switcher={
                  <CourseSelector
                    courses={choices}
                    activeCourseId={selected.courseId}
                    onSelect={selectCourse}
                  />
                }
              />
              <CountUpPolicy animate={play.current.animate}>
                <CourseOverview key={selected.courseId} course={selected} />
              </CountUpPolicy>
            </div>
          </Reveal>
        )}
      </DashboardShell>
    </RequireRole>
  );
}
