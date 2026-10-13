'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchInstructorCourseTimeline } from '@/lib/api/instructor';
import {
  buildTimelineSummary,
  countCourses,
  splitTimeline,
  termLabel,
} from '@/lib/course-timeline-summary';
import { useAuth } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { RequireRole } from '@/components/auth/require-role';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { InstructorCourseTimelineSkeleton } from '@/components/instructor/instructor-dashboard-skeleton';
import { TermCourseList, TermHeading } from '@/components/instructor/instructor-course-timeline';
import { PageHeader } from '@/components/layout/page-header';
import { TEXT_PAGE, TEXT_SECTION } from '@/components/instructor/instructor-ui';
import { PageSection } from '@/components/layout/page-section';
import { Reveal } from '@/components/layout/reveal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

export default function InstructorMyCoursesPage() {
  return (
    <ProtectedRoute>
      <InstructorMyCoursesContent />
    </ProtectedRoute>
  );
}

function InstructorMyCoursesContent() {
  const { user } = useAuth();
  const isInstructor = !!user?.roles.includes('INSTRUCTOR');

  // Own query key/endpoint — this view only needs enrollment + year-level
  // data, not the CLO/PLO/Course-Assessment payload /instructor/dashboard
  // carries, so it doesn't share instructor-dashboard's cache entry.
  const timelineQuery = useQuery({
    queryKey: ['instructor-course-timeline'],
    queryFn: fetchInstructorCourseTimeline,
    enabled: isInstructor,
  });

  const years = useMemo(() => timelineQuery.data?.years ?? [], [timelineQuery.data]);
  const { latest, previousYears } = useMemo(() => splitTimeline(years), [years]);
  const summary = buildTimelineSummary(years);
  const previousCount = countCourses(previousYears);

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
          <PageHeader
            title="รายวิชาที่สอน"
            description={summary ?? 'รายวิชาที่คุณได้รับมอบหมายให้สอน แยกตามภาคเรียน'}
            titleClassName={TEXT_PAGE}
          />
        </Reveal>

        {timelineQuery.isLoading && <InstructorCourseTimelineSkeleton />}

        {timelineQuery.isError && (
          <Alert variant="destructive">
            <AlertDescription>ไม่สามารถโหลดข้อมูลรายวิชาได้ กรุณาลองใหม่อีกครั้ง</AlertDescription>
          </Alert>
        )}

        {timelineQuery.data && !latest && (
          <Reveal index={1}>
            <Card>
              <CardContent className="pt-6">
                <EmptyState
                  illustration="no-data"
                  description="ยังไม่มีวิชาที่ได้รับมอบหมายให้คุณสอน เมื่อมีนิสิตลงทะเบียน วิชาจะขึ้นที่นี่"
                />
              </CardContent>
            </Card>
          </Reveal>
        )}

        {latest && (
          <Reveal index={1}>
            <PageSection
              title={`เทอมล่าสุด — ${termLabel(latest)} · ${latest.semester.courses.length} วิชา`}
              titleClassName={TEXT_SECTION}
              actions={
                <Button asChild variant="outline">
                  <Link href="/instructor/dashboard">
                    ดูผลการเรียนของแต่ละวิชา
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              }
            >
              <TermCourseList semester={latest.semester} academicYear={latest.academicYear} />
            </PageSection>
          </Reveal>
        )}

        {latest && previousYears.length > 0 && (
          <Reveal index={2}>
            <CollapsibleSection
              title="เทอมก่อนหน้า"
              meta={
                <span className="text-sm font-normal text-muted-foreground">
                  {previousCount.courses} วิชา · {previousCount.semesters} เทอม
                </span>
              }
            >
              <div className="space-y-6">
                <p className="text-xs text-muted-foreground">
                  แสดงตามประวัติการลงทะเบียนของนิสิตในแต่ละวิชา หากเพิ่งได้รับมอบหมายให้สอน
                  อาจเห็นเทอมย้อนหลังที่คุณไม่ได้เป็นผู้สอนด้วย
                </p>
                {previousYears.map((yearGroup) => (
                  <div key={yearGroup.academicYear} className="space-y-3">
                    <h2 className="text-base font-semibold text-primary">
                      ปีการศึกษา {yearGroup.academicYear}
                    </h2>
                    {yearGroup.semesters.map((semester) => (
                      <div key={semester.semesterId} className="space-y-2">
                        <TermHeading term={semester.semesterTerm} count={semester.courses.length} />
                        <TermCourseList semester={semester} academicYear={yearGroup.academicYear} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          </Reveal>
        )}
      </DashboardShell>
    </RequireRole>
  );
}
