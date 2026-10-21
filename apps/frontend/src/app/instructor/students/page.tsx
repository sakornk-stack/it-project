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
import { useInstructorStudents } from '@/lib/instructor-queries';
import {
  DEFAULT_STUDENT_FILTERS,
  applyStudentFilters,
  buildStudentsSummary,
  groupByPerson,
  sortPeopleBy,
  type PeopleSort,
  parseStudentFilters,
  studentFiltersToQuery,
  type StudentFilters,
} from '@/lib/student-directory';
import { LOW_GRADE_LABEL } from '@/lib/low-grade';
import { usePagination } from '@/lib/use-pagination';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { StudentFilterBar } from '@/components/instructor/student-filter-bar';
import {
  StudentPersonList,
  StudentPersonListSkeleton,
} from '@/components/instructor/student-person-list';
import { StudentListStatus } from '@/components/instructor/student-card';
import { PageHeader } from '@/components/layout/page-header';
import { Reveal } from '@/components/layout/reveal';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/utils';

export default function InstructorStudentsPage() {
  // useSearchParams requires a Suspense boundary in the App Router
  return (
    <Suspense fallback={<InstructorStudentsFallback />}>
      <InstructorStudentsContent />
    </Suspense>
  );
}

// Same shape as the loaded page while the URL filters are being read; the layout's
// guard has already resolved the user by the time this renders.
function InstructorStudentsFallback() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <DashboardShell role="INSTRUCTOR" identityLabel={user.email} fullName={user.fullName}>
      <PageHeader title="นิสิต" />
      <StudentPersonListSkeleton />
    </DashboardShell>
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
  const query = useInstructorStudents({ enabled: isInstructor });

  const entries = useMemo(() => query.data?.students ?? [], [query.data]);
  const courses = useMemo(() => query.data?.courses ?? [], [query.data]);
  const { grade, courseId } = urlFilters;
  const [sort, setSort] = useState<PeopleSort>('risk');
  const { filtered, counts } = useMemo(() => {
    const result = applyStudentFilters(entries, { grade, courseId, q: search });
    return { filtered: result.people, counts: result.counts };
  }, [entries, grade, courseId, search]);
  const people = useMemo(() => sortPeopleBy(filtered, sort), [filtered, sort]);
  const summary = query.data ? buildStudentsSummary(entries, courses.length) : null;
  const totalPeople = useMemo(() => groupByPerson(entries).length, [entries]);
  const isFiltered = studentFiltersToQuery(filters) !== '';
  // The cards follow the filters one beat behind and fade meanwhile, so typing
  // never blanks the list.
  const listPeople = useDeferredValue(people);
  const listStale = listPeople !== people;
  const pagination = usePagination(listPeople, 12, studentFiltersToQuery(filters));
  // The first cards arrive one after another on the first view only; later
  // filtering and paging swap cards without any entrance.
  const firstView = useRef(true);
  useEffect(() => {
    if (query.data) firstView.current = false;
  }, [query.data]);

  // The layout's guard renders nothing below it until the user is known.
  if (!user) return null;

  const clearFilters = () => {
    setSearch('');
    writeUrl(DEFAULT_STUDENT_FILTERS);
  };

  return (
    <DashboardShell role="INSTRUCTOR" identityLabel={user.email} fullName={user.fullName}>
      <Reveal index={0}>
        <PageHeader
          title="นิสิต"
          description={
            courses.length === 1 && summary
              ? `${courses[0].code} ${courses[0].name} · ${summary}`
              : (summary ?? `นิสิตในวิชาที่คุณสอน เรียงจากคนที่${LOW_GRADE_LABEL}ก่อน`)
          }
        />
      </Reveal>

      {query.isLoading && <StudentPersonListSkeleton />}

      {query.isError && (
        <ApiErrorAlert
          message="ไม่สามารถโหลดข้อมูลนิสิตได้ กรุณาลองใหม่อีกครั้ง"
          onRetry={() => void query.refetch()}
        />
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
              sort={sort}
              onSortChange={setSort}
              isFiltered={isFiltered}
              onClear={clearFilters}
            />
          </Reveal>

          <StudentListStatus shown={people.length} total={totalPeople} sort={sort} />

          {people.length === 0 ? (
            <Reveal index={2}>
              <Card>
                <CardContent className="pt-6">
                  <EmptyState
                    illustration="no-results"
                    title="ไม่พบนิสิต"
                    description="ไม่มีนิสิตที่ตรงกับตัวกรองที่เลือก ลองเปลี่ยนหรือล้างตัวกรอง"
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
                  'space-y-4 transition-opacity duration-150 motion-reduce:transition-none',
                  listStale && 'opacity-60',
                )}
              >
                <StudentPersonList
                  people={pagination.pageRows}
                  showCourse={courses.length > 1}
                  markLow={filters.grade !== 'LOW'}
                  stagger={firstView.current}
                />
                <Pagination {...pagination} unit="คน" onPageChange={pagination.setPage} />
              </div>
            </Reveal>
          )}
        </>
      )}
    </DashboardShell>
  );
}
