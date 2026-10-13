'use client';

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchCurricula,
  fetchDepartments,
  fetchFaculties,
  fetchInactiveDepartments,
  fetchInactiveFaculties,
  fetchInactivePrograms,
  fetchPrograms,
  reactivateOrgRecord,
  type ReactivatableOrgResource,
} from '@/lib/api/organization';
import { buildInactiveOrgRows, type InactiveLevel } from '@/lib/inactive-items';
import { InactiveRecordList } from '@/components/admin/inactive-record-list';
import { PageLoadError } from '@/components/layout/page-states';
import { ListSkeleton } from '@/components/ui/skeleton';

const RESOURCE_OF: Partial<Record<InactiveLevel, ReactivatableOrgResource>> = {
  คณะ: 'faculties',
  ภาควิชา: 'departments',
  สาขา: 'programs',
};

// Same query keys as OrgTree for the active lists, so nothing is fetched twice.
const INACTIVE_KEYS = [['inactive-org']];
const ACTIVE_KEYS = [['faculties'], ['departments'], ['programs'], ['curricula']];

export function InactiveOrgSection() {
  const queryClient = useQueryClient();
  const queries = {
    faculties: useQuery({ queryKey: ['faculties'], queryFn: fetchFaculties }),
    departments: useQuery({ queryKey: ['departments'], queryFn: fetchDepartments }),
    programs: useQuery({ queryKey: ['programs'], queryFn: fetchPrograms }),
    curricula: useQuery({ queryKey: ['curricula'], queryFn: fetchCurricula }),
    inactiveFaculties: useQuery({
      queryKey: ['inactive-org', 'faculties'],
      queryFn: fetchInactiveFaculties,
    }),
    inactiveDepartments: useQuery({
      queryKey: ['inactive-org', 'departments'],
      queryFn: fetchInactiveDepartments,
    }),
    inactivePrograms: useQuery({
      queryKey: ['inactive-org', 'programs'],
      queryFn: fetchInactivePrograms,
    }),
  };
  const all = Object.values(queries);

  const faculties = queries.faculties.data;
  const departments = queries.departments.data;
  const programs = queries.programs.data;
  const curricula = queries.curricula.data;
  const inactiveFaculties = queries.inactiveFaculties.data;
  const inactiveDepartments = queries.inactiveDepartments.data;
  const inactivePrograms = queries.inactivePrograms.data;

  const rows = useMemo(() => {
    if (
      !faculties ||
      !departments ||
      !programs ||
      !curricula ||
      !inactiveFaculties ||
      !inactiveDepartments ||
      !inactivePrograms
    ) {
      return [];
    }
    return buildInactiveOrgRows(
      { faculties, departments, programs, curricula },
      {
        faculties: inactiveFaculties,
        departments: inactiveDepartments,
        programs: inactivePrograms,
        // Curricula are managed by ADMIN, so this page never lists or restores them.
        curricula: [],
      },
    );
  }, [
    faculties,
    departments,
    programs,
    curricula,
    inactiveFaculties,
    inactiveDepartments,
    inactivePrograms,
  ]);

  if (all.some((q) => q.isError)) {
    return <PageLoadError onRetry={() => all.forEach((q) => void q.refetch())} />;
  }
  if (all.some((q) => q.isLoading)) return <ListSkeleton items={3} />;

  return (
    <InactiveRecordList
      rows={rows}
      reactivate={async (row) => {
        await reactivateOrgRecord(RESOURCE_OF[row.level]!, row.id);
        await Promise.all(
          [...INACTIVE_KEYS, ...ACTIVE_KEYS].map((queryKey) =>
            queryClient.invalidateQueries({ queryKey }),
          ),
        );
      }}
    />
  );
}
