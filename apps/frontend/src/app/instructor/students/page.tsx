'use client';

import {
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchInstructorStudents } from '@/lib/api/instructor';
import {
  DEFAULT_STUDENT_FILTERS,
  applyStudentFilters,
  buildStudentsSummary,
  parseStudentFilters,
  studentFiltersToQuery,
  type StudentFilters,
} from '@/lib/student-directory';
import { usePagination } from '@/lib/use-pagination';
import { useAuth } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { RequireRole } from '@/components/auth/require-role';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { StudentFilterBar } from '@/components/instructor/student-filter-bar';
import {
  StudentPersonList,
  StudentPersonListSkeleton,
} from '@/components/instructor/student-person-list';
import { TEXT_PAGE } from '@/components/instructor/instructor-ui';
import { PageHeader } from '@/components/layout/page-header';
import { Reveal } from '@/components/layout/reveal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function InstructorStudentsPage() {
  return (
    <ProtectedRoute>
      {/* useSearchParams requires a Suspense boundary in the App Router */}
      <Suspense fallback={null}>
        <InstructorStudentsContent />
      </Suspense>
    </ProtectedRoute>
  );
}

function InstructorStudentsContent() {
  const { user } = useAuth();
  const isInstructor = !!user?.roles.includes('INSTRUCTOR');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // grade filter and course live only in the URL, so a reload or Back lands on
  // the same view. The search box keeps
  // its own state so typing never waits on the router; each change is still
  // written to ?q= with replace (no history entry per keystroke).
  const urlFilters = parseStudentFilters(searchParams);
  const [search, setSearch] = useState(urlFilters.q);
  const filters: StudentFilters = { ...urlFilters, q: search };

  const writeUrl = useCallback(
    (next: StudentFilters) => {
      const query = studentFiltersToQuery(next);
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  // The endpoint returns every row at once (no paging), so one unfiltered
  // fetch is filtered here: the per-level counts stay put whatever is
  // selected, and changing a filter needs no new request.
  const query = useQuery({
    queryKey: ['instructor-students'],
    queryFn: () => fetchInstructorStudents({}),
    enabled: isInstructor,
  });

  const entries = useMemo(() => query.data?.students ?? [], [query.data]);
  const courses = useMemo(() => query.data?.courses ?? [], [query.data]);
  const { grade, courseId } = urlFilters;
  const { people, counts } = useMemo(
    () => applyStudentFilters(entries, { grade, courseId, q: search }),
    [entries, grade, courseId, search],
  );
  const summary = query.data ? buildStudentsSummary(entries, courses.length) : null;
  const isFiltered = studentFiltersToQuery(filters) !== '';
  // The cards follow the filters one beat behind and fade meanwhile, so typing
  // never blanks the list.
  const listPeople = useDeferredValue(people);
  const listStale = listPeople !== people;
  const pagination = usePagination(listPeople, undefined, studentFiltersToQuery(filters));
  // The first cards arrive one after another on the first view only; later
  // filtering and paging swap cards without any entrance.
  const firstView = useRef(true);
  useEffect(() => {
    if (query.data) firstView.current = false;
  }, [query.data]);

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

  const clearFilters = () => {
    setSearch('');
    writeUrl(DEFAULT_STUDENT_FILTERS);
  };

  return (
    <RequireRole role="INSTRUCTOR">
      <DashboardShell role="INSTRUCTOR" identityLabel={user.email} fullName={user.fullName}>
        <Reveal index={0}>
          <PageHeader
            title="นิสิต"
            description={summary ?? 'นิสิตในวิชาที่คุณสอน เรียงจากคนที่มีเกรด D+ ลงไปก่อน'}
            titleClassName={TEXT_PAGE}
          />
        </Reveal>

        {query.isLoading && <StudentPersonListSkeleton />}

        {query.isError && (
          <Alert variant="destructive">
            <AlertDescription>ไม่สามารถโหลดข้อมูลนิสิตได้ กรุณาลองใหม่อีกครั้ง</AlertDescription>
          </Alert>
        )}

        {query.data && entries.length === 0 && (
          <Reveal index={1}>
            <Card>
              <CardContent className="pt-6">
                <EmptyState
                  illustration="no-students"
                  description={
                    courses.length > 0
                      ? 'ยังไม่มีนิสิตในรายวิชาที่คุณสอน รายชื่อจะขึ้นที่นี่เมื่อมีผลการเรียน'
                      : 'ยังไม่มีวิชาที่ได้รับมอบหมายให้คุณสอน'
                  }
                />
              </CardContent>
            </Card>
          </Reveal>
        )}

        {query.data && entries.length > 0 && (
          <>
            <Reveal index={1}>
              <StudentFilterBar
                counts={counts}
                grade={filters.grade}
                onGradeChange={(grade) => writeUrl({ ...filters, grade })}
                courses={courses}
                courseId={filters.courseId}
                onCourseChange={(courseId) => writeUrl({ ...filters, courseId })}
                search={search}
                onSearchChange={(q) => {
                  setSearch(q);
                  writeUrl({ ...filters, q });
                }}
                isFiltered={isFiltered}
                onClear={clearFilters}
              />
            </Reveal>

            {people.length === 0 ? (
              <Reveal index={2}>
                <Card>
                  <CardContent className="pt-6">
                    <EmptyState
                      illustration="no-results"
                      description="ไม่พบนิสิตที่ตรงกับตัวกรองที่เลือก"
                      action={
                        <Button type="button" variant="outline" onClick={clearFilters}>
                          ล้างตัวกรอง
                        </Button>
                      }
                    />
                  </CardContent>
                </Card>
              </Reveal>
            ) : (
              <Reveal index={2}>
                <div
                  aria-busy={listStale}
                  className={cn(
                    'space-y-3 transition-opacity duration-150 motion-reduce:transition-none',
                    listStale && 'opacity-60',
                  )}
                >
                  <StudentPersonList
                    people={pagination.pageRows}
                    showLowBadge={filters.grade !== 'LOW'}
                    stagger={firstView.current}
                  />
                  <Pagination {...pagination} unit="คน" onPageChange={pagination.setPage} />
                </div>
              </Reveal>
            )}
          </>
        )}
      </DashboardShell>
    </RequireRole>
  );
}
