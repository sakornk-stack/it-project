'use client';

import { Suspense, useCallback, useDeferredValue, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Search, X } from 'lucide-react';
import { fetchPrograms } from '@/lib/api/organization';
import { fetchStaffStudentRisk, fetchStaffYearLevels } from '@/lib/api/staff';
import { usePagination } from '@/lib/use-pagination';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { RequireRole } from '@/components/auth/require-role';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-states';
import { Reveal } from '@/components/layout/reveal';
import { Pagination } from '@/components/ui/pagination';
import { StaffStudentList } from '@/components/staff/staff-student-list';
import {
  SORT_LABELS,
  STATUS_RULES,
  sortRows,
  summarizeStudents,
  toRows,
  type SortKey,
  type StaffStatusKey,
} from '@/components/staff/staff-status';
import { statusIcon, statusLabel } from '@/components/staff/status-badge';
import { StudentsTabs } from '@/components/staff/students-tabs';
import { YEAR_LEVELS, yearInfoFrom, yearLevelTitle } from '@/components/staff/year-info';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Radix reserves '' for "no selection", so "all" needs a sentinel of its own.
const ALL = 'ALL';
// Button order follows the design: the calm statuses first, suspended last.
const BUTTON_ORDER: StaffStatusKey[] = ['NORMAL', 'WATCH', 'CRITICAL', 'NO_DATA', 'SUSPENDED'];
// What each chip counts. The rule texts are the shared ones, so this page cannot
// word a status differently from the overview.
const CHIP_HINTS: Record<string, string> = {
  [ALL]: 'นิสิตทุกสถานะตามตัวกรองที่เลือก',
  ...STATUS_RULES,
  SUSPENDED: 'นิสิตที่ถูกระงับ ไม่นับรวมในสถิติและเปิดดูรายละเอียดไม่ได้',
};
const SORT_KEYS = Object.keys(SORT_LABELS) as SortKey[];

export default function StaffStudentsPage() {
  return (
    <ProtectedRoute>
      <RequireRole role="STAFF">
        {/* useSearchParams requires a Suspense boundary in the App Router */}
        <Suspense fallback={<StaffStudentsSkeleton />}>
          <StaffStudentsContent />
        </Suspense>
      </RequireRole>
    </ProtectedRoute>
  );
}

function StaffStudentsSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-48" />
      <TableSkeleton cols={6} rows={6} />
    </div>
  );
}

function StaffStudentsContent() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pageSize, setPageSize] = useState(10);
  // The search box is uncontrolled; a new key empties it when the filters are cleared.
  const [searchKey, setSearchKey] = useState(0);

  // Filters live only in the URL so a reload, a Back from a student's page or
  // a link from the overview lands on the same view. replace, not push: a
  // filter change should not pile up in history.
  const search = searchParams.get('q') ?? '';
  const status = searchParams.get('risk') ?? ALL;
  const programFilter = searchParams.get('program') ?? ALL;
  const admissionFilter = searchParams.get('year') ?? ALL;
  const levelFilter = searchParams.get('level') ?? ALL;
  const sortParam = searchParams.get('sort') as SortKey | null;
  const sortKey: SortKey = sortParam && SORT_KEYS.includes(sortParam) ? sortParam : 'severity';
  // On a phone the dropdown filters sit behind a "ตัวกรอง" button, so the search
  // box, the status chips and the results come first. A link that already
  // carries one of them (from the overview) opens the panel.
  const activeFilterCount =
    [levelFilter, programFilter, admissionFilter].filter((v) => v !== ALL).length +
    (sortKey === 'severity' ? 0 : 1);
  const [filtersOpen, setFiltersOpen] = useState(activeFilterCount > 0);

  const updateParams = useCallback(
    (changes: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === '' || value === ALL) params.delete(key);
        else params.set(key, value);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const studentsQuery = useQuery({
    queryKey: ['staff-student-risk'],
    queryFn: fetchStaffStudentRisk,
  });
  const yearsQuery = useQuery({
    queryKey: ['staff-year-levels'],
    queryFn: fetchStaffYearLevels,
  });
  const programsQuery = useQuery({
    queryKey: ['programs'],
    queryFn: fetchPrograms,
  });

  const allRows = useMemo(
    () => toRows(studentsQuery.data ?? [], yearInfoFrom(yearsQuery.data).levelById),
    [studentsQuery.data, yearsQuery.data],
  );
  const admissionYears = useMemo(
    () => [...new Set(allRows.map((row) => row.admissionYear))].sort((a, b) => b - a),
    [allRows],
  );
  const programIds = useMemo(() => [...new Set(allRows.map((row) => row.programId))], [allRows]);
  const programNames = useMemo(
    () => new Map((programsQuery.data ?? []).map((program) => [program.id, program.name])),
    [programsQuery.data],
  );

  // Everything except the status, so each status button can say how many it would show.
  const beforeStatus = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allRows.filter(
      (row) =>
        (programFilter === ALL || row.programId === programFilter) &&
        (admissionFilter === ALL || row.admissionYear === Number(admissionFilter)) &&
        (levelFilter === ALL || row.yearLevel === Number(levelFilter)) &&
        (term === '' ||
          row.fullName.toLowerCase().includes(term) ||
          row.studentCode.toLowerCase().includes(term)),
    );
  }, [allRows, search, programFilter, admissionFilter, levelFilter]);
  const shown = useMemo(
    () =>
      sortRows(
        beforeStatus.filter((row) => status === ALL || row.status === status),
        sortKey,
      ),
    [beforeStatus, status, sortKey],
  );
  const summary = summarizeStudents(beforeStatus);
  const shownSummary = summarizeStudents(shown);

  // The table follows the filters one beat behind and fades while it catches up,
  // so typing or switching a chip never blanks or jumps the list.
  const listRows = useDeferredValue(shown);
  const listStale = listRows !== shown;
  const pagination = usePagination(
    listRows,
    pageSize,
    `${listRows.length}|${listRows[0]?.studentProfileId ?? ''}|${sortKey}|${pageSize}`,
  );
  const hasFilters = search !== '' || status !== ALL || activeFilterCount > 0;
  const clearFilters = () => {
    setSearchKey((key) => key + 1);
    router.replace(pathname, { scroll: false });
  };

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

  const statusButtons: { key: string; label: string; count: number }[] = [
    { key: ALL, label: 'ทั้งหมด', count: beforeStatus.length },
    ...BUTTON_ORDER.map((key) => ({
      key,
      label: statusLabel(key),
      count:
        key === 'SUSPENDED'
          ? summary.suspended
          : summary.byStatus[key as Exclude<StaffStatusKey, 'SUSPENDED'>],
    })),
  ];

  return (
    <DashboardShell role="STAFF" identityLabel={user.email} fullName={user.fullName}>
      <Reveal index={0}>
        <PageHeader
          title="นิสิต"
          description="นิสิตในขอบเขตความรับผิดชอบของคุณ แบ่งตามสถานะทางวิชาการ"
        />
      </Reveal>

      <Reveal index={0}>
        <StudentsTabs active="list" count={allRows.length} />
      </Reveal>

      <Reveal index={1}>
        <Card>
          <CardContent className="grid grid-cols-1 gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] xl:items-end">
            <label className="order-1 block space-y-1.5 md:order-none">
              <span className="text-xs font-medium text-muted-foreground">
                ค้นหาด้วยรหัสนิสิตหรือชื่อ-นามสกุล
              </span>
              <span className="relative block">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  key={searchKey}
                  className="pl-9"
                  placeholder="ค้นหาด้วยรหัสนิสิต หรือชื่อ-นามสกุล"
                  defaultValue={search}
                  onChange={(e) => updateParams({ q: e.target.value })}
                />
              </span>
            </label>
            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-controls="staff-student-filters"
              onClick={() => setFiltersOpen((open) => !open)}
              className="order-4 inline-flex min-h-11 items-center justify-between gap-2 rounded border border-slate-300 bg-card px-3.5 text-sm font-semibold text-primary hover:bg-slate-50 md:hidden"
            >
              <span>
                ตัวกรอง
                {activeFilterCount > 0 && (
                  <span className="ml-1.5 tabular-nums text-muted-foreground">
                    ({activeFilterCount})
                  </span>
                )}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  'h-4 w-4 transition-transform motion-reduce:transition-none',
                  filtersOpen && 'rotate-180',
                )}
              />
            </button>
            <div
              id="staff-student-filters"
              className={cn(
                'order-5 gap-3 md:order-none md:grid md:grid-cols-2',
                programIds.length > 1 ? 'xl:grid-cols-4' : 'md:grid-cols-3',
                filtersOpen ? 'flex flex-col' : 'hidden',
              )}
            >
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">ชั้นปี</span>
                <Select value={levelFilter} onValueChange={(v) => updateParams({ level: v })}>
                  <SelectTrigger aria-label="ชั้นปี">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>ทุกชั้นปี</SelectItem>
                    {YEAR_LEVELS.map((level) => (
                      <SelectItem key={level} value={String(level)}>
                        {yearLevelTitle(level)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">เรียงตาม</span>
                <Select
                  value={sortKey}
                  onValueChange={(v) => updateParams({ sort: v === 'severity' ? null : v })}
                >
                  <SelectTrigger aria-label="เรียงตาม">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_KEYS.map((key) => (
                      <SelectItem key={key} value={key}>
                        {SORT_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              {programIds.length > 1 && (
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">สาขา</span>
                  <Select value={programFilter} onValueChange={(v) => updateParams({ program: v })}>
                    <SelectTrigger aria-label="สาขา">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>ทุกสาขา</SelectItem>
                      {programIds.map((id) => (
                        <SelectItem key={id} value={id}>
                          {programNames.get(id) ?? id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              )}
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">ปีที่เข้าศึกษา</span>
                <Select value={admissionFilter} onValueChange={(v) => updateParams({ year: v })}>
                  <SelectTrigger aria-label="ปีที่เข้าศึกษา">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>ทุกปีที่เข้าศึกษา</SelectItem>
                    {admissionYears.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        ปีเข้า {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>

            <div className="order-2 space-y-2 md:order-none xl:col-span-2">
              <div
                role="group"
                aria-label="จำแนกตามสถานะทางวิชาการ"
                className="flex flex-wrap gap-2"
              >
                {statusButtons.map(({ key, label, count }) => {
                  const on = status === key;
                  const Icon = key === ALL ? null : statusIcon(key as StaffStatusKey);
                  return (
                    <Tooltip key={key}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-pressed={on}
                          aria-describedby="staff-status-hint"
                          onClick={() => updateParams({ risk: key })}
                          className={cn(
                            'inline-flex min-h-11 items-center gap-2 rounded border px-3.5 text-sm font-semibold transition-colors motion-reduce:transition-none',
                            on
                              ? 'border-brand bg-brand text-brand-foreground'
                              : 'border-slate-300 bg-card text-primary hover:bg-slate-50',
                          )}
                        >
                          {Icon && <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />}
                          {label}
                          <span
                            className={cn(
                              'tabular-nums text-xs',
                              on ? 'opacity-90' : 'text-muted-foreground',
                            )}
                          >
                            {count}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{CHIP_HINTS[key]}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
              {/* The same text as the tooltip, for touch screens where there is no hover. */}
              <p id="staff-status-hint" className="text-xs text-muted-foreground">
                {status === ALL
                  ? `เกณฑ์ตาม GPA สะสม: ${(['CRITICAL', 'WATCH', 'NORMAL'] as const)
                      .map(
                        (key) => `${statusLabel(key)} ${STATUS_RULES[key].replace('GPA สะสม', '')}`,
                      )
                      .join(' · ')}`
                  : `${statusLabel(status as StaffStatusKey)}: ${CHIP_HINTS[status] ?? ''}`}
              </p>
            </div>

            <div className="order-3 flex flex-wrap items-center justify-between gap-2 md:order-none xl:col-span-2">
              <p className="text-sm text-muted-foreground">
                พบ <span className="font-semibold tabular-nums text-primary">{shown.length}</span>{' '}
                คน (ใช้งาน <span className="tabular-nums">{shownSummary.active}</span> คน, ระงับ{' '}
                <span className="tabular-nums">{shownSummary.suspended}</span> คน)
              </p>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded border border-slate-300 bg-card px-3.5 text-sm font-semibold text-primary transition-colors hover:bg-slate-50 motion-reduce:transition-none"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                  ล้างตัวกรอง
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </Reveal>

      <Reveal index={2}>
        {studentsQuery.isLoading && (
          <Card>
            <CardContent className="pt-6">
              <TableSkeleton cols={6} rows={6} />
            </CardContent>
          </Card>
        )}
        {studentsQuery.isError && <PageLoadError onRetry={() => studentsQuery.refetch()} />}
        {studentsQuery.data && (
          <Card>
            <CardContent className="p-0 md:p-0">
              <div
                aria-busy={listStale}
                className={cn(
                  'p-4 transition-opacity duration-150 motion-reduce:transition-none md:p-0',
                  listStale && 'opacity-60',
                )}
              >
                <StaffStudentList
                  rows={pagination.pageRows}
                  programName={(id) => programNames.get(id) ?? '—'}
                />
              </div>
              {pagination.total > 0 && (
                <div className="px-4 pb-4 md:px-5">
                  <Pagination
                    page={pagination.page}
                    pageCount={pagination.pageCount}
                    total={pagination.total}
                    rangeStart={pagination.rangeStart}
                    rangeEnd={pagination.rangeEnd}
                    unit="คน"
                    pageSize={pageSize}
                    onPageChange={pagination.setPage}
                    onPageSizeChange={setPageSize}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </Reveal>
    </DashboardShell>
  );
}
