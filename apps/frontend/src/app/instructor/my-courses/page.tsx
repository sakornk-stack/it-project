'use client';

import { useMemo } from 'react';
import { History } from 'lucide-react';
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
import {
  TermCourseList,
  TermHeading,
  TermSummaryStrip,
} from '@/components/instructor/instructor-course-timeline';
import { PageHeader } from '@/components/layout/page-header';
import { CollapsibleCard } from '@/components/instructor/section-card';
import { TEXT_PAGE } from '@/components/instructor/instructor-ui';
import { PageSection } from '@/components/layout/page-section';
import { Reveal } from '@/components/layout/reveal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
              title={
                <span className="flex flex-wrap items-center gap-2">
                  เทอมล่าสุด
                  <Badge tone="neutral" className="whitespace-nowrap px-2.5 text-[13px]">
                    {termLabel(latest)}
                  </Badge>
                </span>
              }
            >
              <div className="space-y-6">
                <TermSummaryStrip courses={latest.semester.courses} />
                <TermCourseList semester={latest.semester} academicYear={latest.academicYear} />
              </div>
            </PageSection>
          </Reveal>
        )}

        {latest && previousYears.length > 0 && (
          <Reveal index={2}>
            <CollapsibleCard
              icon={History}
              title="เทอมก่อนหน้า"
              description={
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral" className="whitespace-nowrap">
                    {previousCount.courses} วิชา
                  </Badge>
                  <Badge tone="neutral" className="whitespace-nowrap">
                    {previousCount.semesters} เทอม
                  </Badge>
                </span>
              }
              defaultOpen={false}
            >
              <div className="space-y-6">
                {previousYears.map((yearGroup) => (
                  <div key={yearGroup.academicYear} className="space-y-3">
                    <h3 className="text-sm font-semibold text-primary">
                      ปีการศึกษา {yearGroup.academicYear}
                    </h3>
                    {yearGroup.semesters.map((semester) => (
                      <div
                        key={semester.semesterId}
                        className="space-y-2 border-l-2 border-slate-200 pl-4"
                      >
                        <TermHeading term={semester.semesterTerm} count={semester.courses.length} />
                        <TermCourseList
                          semester={semester}
                          academicYear={yearGroup.academicYear}
                          compact
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </CollapsibleCard>
          </Reveal>
        )}
      </DashboardShell>
    </RequireRole>
  );
}
