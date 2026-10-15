'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { fetchInstructorDashboard } from '@/lib/api/instructor';
import { useAuth } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { RequireRole } from '@/components/auth/require-role';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { InstructorCourseSkeleton } from '@/components/instructor/instructor-dashboard-skeleton';
import { CourseTabStrip } from '@/components/instructor/course-tab-strip';
import {
  InstructorDetailPanel,
  parseInstructorTab,
  type InstructorTab,
} from '@/components/instructor/instructor-detail-panel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

export default function InstructorCoursePage({ params }: { params: { courseId: string } }) {
  return (
    <ProtectedRoute>
      {/* useSearchParams requires a Suspense boundary in the App Router */}
      <Suspense fallback={<InstructorCourseSkeleton />}>
        <InstructorCourseContent courseId={params.courseId} />
      </Suspense>
    </ProtectedRoute>
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
  const dashboardQuery = useQuery({
    queryKey: ['instructor-dashboard'],
    queryFn: fetchInstructorDashboard,
    enabled: isInstructor,
  });

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

  const course = dashboardQuery.data?.courses.find((c) => c.courseId === courseId) ?? null;

  return (
    <RequireRole role="INSTRUCTOR">
      <DashboardShell role="INSTRUCTOR" identityLabel={user.email} fullName={user.fullName}>
        <Link
          href="/instructor/dashboard"
          className="inline-flex min-h-11 w-fit items-center gap-1 self-start text-sm text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft size={14} />
          กลับไปภาพรวม
        </Link>

        {dashboardQuery.data && (
          <CourseTabStrip
            courses={dashboardQuery.data.courses}
            activeCourseId={courseId}
            tabParam={tabParam}
          />
        )}

        {dashboardQuery.isLoading && <InstructorCourseSkeleton withSwitcher />}

        {dashboardQuery.isError && (
          <Alert variant="destructive">
            <AlertDescription>ไม่สามารถโหลดข้อมูลรายวิชาได้ กรุณาลองใหม่อีกครั้ง</AlertDescription>
          </Alert>
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
    </RequireRole>
  );
}
