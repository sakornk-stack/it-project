'use client';

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchInactiveAcademicYears,
  fetchInactiveSemesters,
  permanentlyDeleteAcademicYear,
  permanentlyDeleteSemester,
  reactivateAcademicYear,
  reactivateSemester,
} from '@/lib/api/admin';
import { fetchAcademicYears } from '@/lib/api/academic-record';
import { buildInactiveCalendarRows } from '@/lib/inactive-items';
import { InactiveRecordList } from '@/components/admin/inactive-record-list';
import { PageLoadError } from '@/components/layout/page-states';
import { Skeleton } from '@/components/ui/skeleton';

export function AcademicYearInactiveSection() {
  const queryClient = useQueryClient();
  const years = useQuery({ queryKey: ['academic-years'], queryFn: fetchAcademicYears });
  const inactiveYears = useQuery({
    queryKey: ['inactive-calendar', 'years'],
    queryFn: fetchInactiveAcademicYears,
  });
  const inactiveSemesters = useQuery({
    queryKey: ['inactive-calendar', 'semesters'],
    queryFn: fetchInactiveSemesters,
  });
  const all = [years, inactiveYears, inactiveSemesters];

  const rows = useMemo(
    () =>
      years.data && inactiveYears.data && inactiveSemesters.data
        ? buildInactiveCalendarRows(years.data, inactiveYears.data, inactiveSemesters.data)
        : [],
    [years.data, inactiveYears.data, inactiveSemesters.data],
  );

  if (all.some((q) => q.isError)) {
    return <PageLoadError onRetry={() => all.forEach((q) => void q.refetch())} />;
  }
  if (all.some((q) => q.isLoading)) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[4.5rem] w-full rounded-lg" />
        ))}
      </div>
    );
  }

  async function refreshAll() {
    await Promise.all(
      [['inactive-calendar'], ['academic-years'], ['semesters']].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
  }

  return (
    <InactiveRecordList
      rows={rows}
      permanentDelete={async (row) => {
        if (row.level === 'ปีการศึกษา') await permanentlyDeleteAcademicYear(row.id);
        else await permanentlyDeleteSemester(row.id);
        await refreshAll();
      }}
      reactivate={async (row) => {
        if (row.level === 'ปีการศึกษา') await reactivateAcademicYear(row.id);
        else await reactivateSemester(row.id);
        await refreshAll();
      }}
    />
  );
}
