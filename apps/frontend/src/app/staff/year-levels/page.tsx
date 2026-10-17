'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchStaffStudentRisk, fetchStaffYearLevels } from '@/lib/api/staff';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-states';
import { Reveal } from '@/components/layout/reveal';
import { OverviewYearTable } from '@/components/staff/overview-year-table';
import { summarizeByYearLevel, summarizeStudents, toRows } from '@/components/staff/staff-status';
import { StudentsTabs } from '@/components/staff/students-tabs';
import { YEAR_LEVELS, yearInfoFrom } from '@/components/staff/year-info';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

export default function StaffYearLevelsPage() {
  const { user } = useAuth();
  // The same list the overview and the student list count, with the year each
  // student is in taken from the year-level report.
  const studentsQuery = useQuery({
    queryKey: ['staff-student-risk'],
    queryFn: fetchStaffStudentRisk,
  });
  const yearsQuery = useQuery({
    queryKey: ['staff-year-levels'],
    queryFn: fetchStaffYearLevels,
  });

  const view = useMemo(() => {
    if (!studentsQuery.data || !yearsQuery.data) return null;
    const info = yearInfoFrom(yearsQuery.data);
    const rows = toRows(studentsQuery.data, info.levelById);
    const years = summarizeByYearLevel(rows, info.behindIds, YEAR_LEVELS);
    return {
      summary: summarizeStudents(studentsQuery.data),
      years,
      totalBehind: years.reduce((sum, y) => sum + y.behind, 0),
    };
  }, [studentsQuery.data, yearsQuery.data]);

  if (!user) return null;

  const failed = studentsQuery.isError || yearsQuery.isError;

  return (
    <DashboardShell role="STAFF" identityLabel={user.email} fullName={user.fullName}>
      <Reveal index={0}>
        <PageHeader
          title="นิสิต"
          description="นิสิตที่ใช้งานอยู่ในขอบเขตที่คุณดูแล แบ่งตามชั้นปี (ไม่รวมนิสิตที่ถูกระงับ)"
        />
      </Reveal>

      <Reveal index={0}>
        <StudentsTabs active="years" count={studentsQuery.data?.length} />
      </Reveal>

      {!view && !failed && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      )}

      {failed && (
        <PageLoadError
          onRetry={() => {
            studentsQuery.refetch();
            yearsQuery.refetch();
          }}
        />
      )}

      {view && view.summary.active === 0 && (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              illustration="no-students"
              description="ยังไม่มีนิสิตในขอบเขตที่คุณดูแล"
            />
          </CardContent>
        </Card>
      )}

      {view && view.summary.active > 0 && (
        <Reveal index={1}>
          <OverviewYearTable
            years={view.years}
            total={view.summary}
            totalBehind={view.totalBehind}
          />
        </Reveal>
      )}
    </DashboardShell>
  );
}
