'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, GraduationCap, ListChecks, Plus, Search, UserX } from 'lucide-react';
import { fetchCourses } from '@/lib/api/academic-record';
import {
  deleteCourseInstructor,
  fetchCourseCategories,
  fetchCourseInstructors,
  fetchCurriculumRequirements,
  fetchInstructorsInScope,
  fetchPrerequisites,
  fetchStaffOverview,
} from '@/lib/api/staff';
import { useAuth } from '@/lib/auth-context';
import { describeApiError } from '@/lib/describe-api-error';
import { OWN_SENTENCE_ONLY, STAFF_WRITE_ERRORS } from '@/lib/api-error-presets';
import { useToast } from '@/lib/toast-context';
import { cn } from '@/lib/utils';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-states';
import { Reveal } from '@/components/layout/reveal';
import { CategorySection } from '@/components/staff/category-section';
import { CourseCategoryForm } from '@/components/staff/course-category-form';
import { AssignInstructorSheet } from '@/components/staff/assign-instructor-sheet';
import { CourseEditSheet, type CourseSheetTarget } from '@/components/staff/course-edit-sheet';
import { CourseRows } from '@/components/staff/course-rows';
import { CurriculumInstructorsTab } from '@/components/staff/curriculum-instructors-tab';
import { InactiveCoursesSection } from '@/components/staff/inactive-courses-section';
import {
  buildCurriculumView,
  categoryOpenByDefault,
  type InstructorFilter,
} from '@/components/staff/curriculum-view';
import { Button } from '@/components/ui/button';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const ALL = 'ALL';
type CurriculumTab = 'structure' | 'instructors';

export default function StaffCurriculumPage() {
  return (
    /* useSearchParams requires a Suspense boundary in the App Router */
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="space-y-3">
            <Skeleton className="mx-auto h-10 w-10 rounded-full" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      }
    >
      <StaffCurriculumContent />
    </Suspense>
  );
}

function StaffCurriculumContent() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [sheet, setSheet] = useState<CourseSheetTarget | null>(null);
  const [assignCourseId, setAssignCourseId] = useState<string | null>(null);
  // What the user folded or unfolded by hand; any change of search or filter
  // starts over from the automatic choice.
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});

  // The address keeps the whole selection, so a link from the overview, a
  // reload or Back lands on the same curriculum, filter and course. Older links
  // (tab=prerequisites / tab=instructors with a courseId) still open.
  const curriculumId = searchParams.get('curriculumId');
  const categoryParam = searchParams.get('categoryId');
  const courseId = searchParams.get('courseId');
  const instructorParam = searchParams.get('instructor');
  const instructorFilter: InstructorFilter =
    instructorParam === 'none' || instructorParam === 'has' ? instructorParam : 'all';
  const tab: CurriculumTab =
    searchParams.get('tab') === 'instructors' && !courseId ? 'instructors' : 'structure';

  useEffect(() => {
    setManualOpen({});
  }, [search, categoryParam, instructorFilter, courseId]);

  const setParams = useCallback(
    (changes: Record<string, string | null>, mode: 'push' | 'replace' = 'replace') => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === '' || value === ALL) params.delete(key);
        else params.set(key, value);
      }
      router[mode](`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  // One request per list for the whole page — nothing is fetched per course.
  const overviewQuery = useQuery({
    queryKey: ['staff-overview'],
    queryFn: fetchStaffOverview,
  });
  const categoriesQuery = useQuery({
    queryKey: ['course-categories'],
    queryFn: fetchCourseCategories,
  });
  const requirementsQuery = useQuery({
    queryKey: ['curriculum-requirements'],
    queryFn: fetchCurriculumRequirements,
  });
  const coursesQuery = useQuery({
    queryKey: ['courses'],
    queryFn: fetchCourses,
  });
  const prerequisitesQuery = useQuery({
    queryKey: ['prerequisites'],
    queryFn: fetchPrerequisites,
  });
  const assignmentsQuery = useQuery({
    queryKey: ['course-instructors'],
    queryFn: fetchCourseInstructors,
  });
  const instructorsQuery = useQuery({
    queryKey: ['instructors-in-scope'],
    queryFn: fetchInstructorsInScope,
  });

  const curricula = useMemo(
    () =>
      (overviewQuery.data?.programs ?? []).flatMap((program) =>
        program.curricula.map((curriculum) => ({
          id: curriculum.curriculumId,
          label: `${program.programCode} ${program.programName} · ฉบับ ${curriculum.version} (พ.ศ. ${curriculum.effectiveYear})`,
          studentCount: curriculum.studentCount,
          totalCourses: curriculum.totalCourses,
        })),
      ),
    [overviewQuery.data],
  );

  // Nothing chosen yet: start on the curriculum staff most likely work on — the one
  // with students, then the one with courses — not an empty one that sorts first.
  const firstCurriculumId = useMemo(
    () =>
      [...curricula].sort(
        (a, b) => b.studentCount - a.studentCount || b.totalCourses - a.totalCourses,
      )[0]?.id,
    [curricula],
  );
  useEffect(() => {
    if (!curriculumId && firstCurriculumId) setParams({ curriculumId: firstCurriculumId });
  }, [curriculumId, firstCurriculumId, setParams]);

  const inScope = curriculumId !== null && curricula.some((c) => c.id === curriculumId);
  const loaded =
    categoriesQuery.data &&
    requirementsQuery.data &&
    coursesQuery.data &&
    prerequisitesQuery.data &&
    assignmentsQuery.data &&
    instructorsQuery.data;
  const curriculumCategories = (categoriesQuery.data ?? []).filter(
    (c) => c.curriculumId === curriculumId && c.isActive,
  );
  const failed =
    overviewQuery.isError ||
    categoriesQuery.isError ||
    requirementsQuery.isError ||
    coursesQuery.isError ||
    prerequisitesQuery.isError ||
    assignmentsQuery.isError;

  const view = useMemo(() => {
    if (!inScope || !curriculumId || !loaded) return null;
    return buildCurriculumView({
      curriculumId,
      courses: coursesQuery.data!,
      categories: categoriesQuery.data!,
      requirements: requirementsQuery.data!,
      prerequisites: prerequisitesQuery.data!,
      assignments: assignmentsQuery.data!,
      instructors: instructorsQuery.data!,
      filters: {
        search,
        categoryId: categoryParam,
        instructor: instructorFilter,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    inScope,
    curriculumId,
    loaded,
    coursesQuery.data,
    categoriesQuery.data,
    requirementsQuery.data,
    prerequisitesQuery.data,
    assignmentsQuery.data,
    instructorsQuery.data,
    search,
    categoryParam,
    instructorFilter,
  ]);

  const refetchAll = useCallback(() => {
    for (const key of [
      'course-categories',
      'curriculum-requirements',
      'courses',
      'prerequisites',
      'course-instructors',
    ]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  }, [queryClient]);

  // Flow that writes: DELETE /course-instructors/:id
  async function withdraw(assignmentId: string) {
    try {
      await deleteCourseInstructor(assignmentId);
      toast.success('ถอนอาจารย์แล้ว');
      refetchAll();
    } catch (error) {
      toast.error(
        describeApiError(
          error,
          STAFF_WRITE_ERRORS,
          'ถอนอาจารย์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
          OWN_SENTENCE_ONLY,
        ),
      );
      throw error;
    }
  }

  if (!user) return null;

  const allBlocks = view?.blocks ?? [];
  const activeCoursesInCurriculum = (coursesQuery.data ?? []).filter(
    (c) => c.curriculumId === curriculumId && c.isActive,
  );
  const filtered = search.trim() !== '' || categoryParam !== null || instructorFilter !== 'all';
  const tabs: { key: CurriculumTab; label: string }[] = [
    { key: 'structure', label: 'โครงสร้างหมวดวิชาและรายวิชา' },
    {
      key: 'instructors',
      label: `อาจารย์ผู้รับผิดชอบวิชา (ระดับหลักสูตร)${view ? ` ${view.instructorEntries.length} ท่าน` : ''}`,
    },
  ];

  return (
    <DashboardShell role="STAFF" identityLabel={user.email} fullName={user.fullName}>
      <Reveal index={0}>
        <PageHeader
          title="การจัดการหลักสูตรและรายวิชา"
          description="จัดการหมวดวิชา รายวิชา วิชาบังคับก่อน และอาจารย์ผู้รับผิดชอบวิชา ภายในขอบเขตของคุณ"
          actions={
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="block max-w-full space-y-1.5 sm:w-96">
                <span className="text-xs font-medium text-muted-foreground">
                  หลักสูตรและสาขาวิชา
                </span>
                <Select
                  value={inScope ? (curriculumId ?? undefined) : undefined}
                  onValueChange={(id) =>
                    setParams(
                      {
                        curriculumId: id,
                        categoryId: null,
                        courseId: null,
                        instructor: null,
                      },
                      'push',
                    )
                  }
                  disabled={curricula.length === 0}
                >
                  <SelectTrigger className="text-left" aria-label="เลือกหลักสูตร">
                    <SelectValue placeholder="เลือกหลักสูตร" />
                  </SelectTrigger>
                  <SelectContent>
                    {curricula.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="min-h-11">
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              {inScope && (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5 px-4"
                  disabled={!loaded || curriculumCategories.length === 0}
                  onClick={() => setSheet({ kind: 'create', defaultCategoryId: categoryParam })}
                >
                  <Plus aria-hidden="true" size={16} />
                  เพิ่มรายวิชาใหม่
                </Button>
              )}
              {inScope && loaded && tab === 'structure' && (
                <Button
                  type="button"
                  variant={showCategoryForm ? 'outline' : 'default'}
                  className="gap-1.5 px-4"
                  onClick={() => setShowCategoryForm((open) => !open)}
                >
                  {showCategoryForm ? (
                    'ยกเลิก'
                  ) : (
                    <>
                      <Plus aria-hidden="true" size={16} />
                      เพิ่มหมวดวิชา
                    </>
                  )}
                </Button>
              )}
            </div>
          }
        />
      </Reveal>

      {overviewQuery.data && curricula.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={GraduationCap}
              title="ยังไม่มีสาขาในความดูแล"
              description="จึงไม่มีหลักสูตรให้แสดง ติดต่อผู้ดูแลระบบ (ADMIN) เพื่อกำหนดขอบเขตของคุณ"
            />
          </CardContent>
        </Card>
      )}
      {curriculumId && overviewQuery.data && !inScope && (
        <p className="text-sm text-amber-600">
          หลักสูตรในลิงก์นี้อยู่นอกขอบเขตที่คุณดูแล — เลือกสาขาและฉบับจากรายการด้านบนแทน
        </p>
      )}
      {failed && (
        <PageLoadError
          onRetry={() => {
            overviewQuery.refetch();
            refetchAll();
          }}
        />
      )}

      {inScope && !loaded && !failed && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      )}

      {view && curriculumId && (
        <>
          <Reveal index={1}>
            <Card>
              <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 sm:p-5">
                <p className="flex items-center gap-2 text-sm">
                  <BookOpen aria-hidden="true" className="h-4 w-4 shrink-0 text-brand" />
                  <span>
                    จำนวนรายวิชาทั้งหมด{' '}
                    <span className="font-semibold tabular-nums">
                      <AnimatedNumber value={view.totalCourses} />
                    </span>{' '}
                    วิชา
                  </span>
                </p>
                <p className="flex items-center gap-2 text-sm">
                  <ListChecks aria-hidden="true" className="h-4 w-4 shrink-0 text-brand" />
                  <span>
                    รวม{' '}
                    <span className="font-semibold tabular-nums">
                      <AnimatedNumber value={view.totalCredits} />
                    </span>{' '}
                    หน่วยกิต
                  </span>
                </p>
                <p
                  className={cn(
                    'flex items-center gap-2 text-sm',
                    view.withoutInstructor > 0 && 'font-medium text-red-700',
                  )}
                >
                  <UserX aria-hidden="true" className="h-4 w-4 shrink-0" />
                  {view.withoutInstructor > 0 ? (
                    <span>
                      วิชาที่ยังไม่มีอาจารย์ผู้รับผิดชอบ{' '}
                      <span className="font-semibold tabular-nums">
                        <AnimatedNumber value={view.withoutInstructor} />
                      </span>{' '}
                      วิชา
                    </span>
                  ) : view.totalCourses === 0 ? (
                    <span>ยังไม่มีรายวิชาให้มอบหมายอาจารย์</span>
                  ) : (
                    <span>ทุกวิชามีอาจารย์ผู้รับผิดชอบแล้ว</span>
                  )}
                </p>
              </CardContent>
            </Card>
          </Reveal>

          <div
            role="tablist"
            aria-label="ส่วนของหน้าหลักสูตร"
            className="flex flex-wrap gap-1 rounded-lg border bg-card p-1"
          >
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() =>
                  setParams({
                    tab: key === 'structure' ? null : key,
                    courseId: null,
                  })
                }
                className={cn(
                  'min-h-11 rounded-md px-3.5 text-left text-sm font-semibold transition motion-reduce:transition-none',
                  tab === key
                    ? 'bg-brand text-brand-foreground'
                    : 'text-muted-foreground hover:bg-slate-50',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
            การมอบหมายอาจารย์ผู้รับผิดชอบวิชาเป็นระดับหลักสูตร ไม่ผูกกับภาคเรียน
            อาจารย์ที่ยังไม่ถูกมอบหมายจะไม่เห็นวิชานั้นในระบบ
          </p>

          {tab === 'instructors' && (
            <CurriculumInstructorsTab
              entries={view.instructorEntries}
              courseHref={(id) => `${pathname}?curriculumId=${curriculumId}&courseId=${id}`}
            />
          )}

          {tab === 'structure' && (
            <>
              <Card>
                <CardContent className="space-y-4 p-4 sm:p-5">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                    <label className="block space-y-1.5 md:col-span-2 xl:col-span-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        ค้นหารหัสวิชาหรือชื่อรายวิชา (ไทย/อังกฤษ)
                      </span>
                      <span className="relative block">
                        <Search
                          aria-hidden="true"
                          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                        />
                        <Input
                          className="pl-9"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="ค้นหารหัสวิชา หรือชื่อรายวิชา"
                        />
                      </span>
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">หมวดวิชา</span>
                      <Select
                        value={categoryParam ?? ALL}
                        onValueChange={(v) => setParams({ categoryId: v, courseId: null })}
                      >
                        <SelectTrigger aria-label="หมวดวิชา">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL}>หมวดวิชาทั้งหมด</SelectItem>
                          {(categoriesQuery.data ?? [])
                            .filter((c) => c.curriculumId === curriculumId)
                            .map((c) => (
                              <SelectItem key={c.id} value={c.id} className="min-h-11">
                                {c.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        สถานะอาจารย์
                      </span>
                      <Select
                        value={instructorFilter === 'all' ? ALL : instructorFilter}
                        onValueChange={(v) => setParams({ instructor: v, courseId: null })}
                      >
                        <SelectTrigger aria-label="สถานะอาจารย์">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL}>ทั้งหมด</SelectItem>
                          <SelectItem value="none">ยังไม่มีอาจารย์</SelectItem>
                          <SelectItem value="has">มีอาจารย์แล้ว</SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2 empty:hidden">
                    {filtered && (
                      <Button
                        type="button"
                        variant="outline"
                        className="px-4"
                        onClick={() => {
                          setSearch('');
                          setParams({
                            categoryId: null,
                            instructor: null,
                            courseId: null,
                          });
                        }}
                      >
                        ล้างตัวกรอง
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {showCategoryForm && (
                <CourseCategoryForm
                  curriculumId={curriculumId}
                  onCancel={() => setShowCategoryForm(false)}
                  onCreated={() => {
                    setShowCategoryForm(false);
                    refetchAll();
                  }}
                />
              )}

              {allBlocks.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <EmptyState
                      icon={BookOpen}
                      title="หลักสูตรนี้ยังไม่มีหมวดวิชา"
                      description="รายวิชาต้องอยู่ในหมวด จึงต้องเพิ่มหมวดวิชาก่อน แล้วค่อยเพิ่มรายวิชา"
                    />
                  </CardContent>
                </Card>
              ) : (
                allBlocks.map((block) => {
                  const open =
                    manualOpen[block.category.id] ??
                    categoryOpenByDefault(
                      block,
                      { search, categoryId: categoryParam, instructor: instructorFilter },
                      courseId,
                    );
                  return (
                    <Reveal key={block.category.id}>
                      <CategorySection
                        block={block}
                        expanded={open}
                        onToggle={() =>
                          setManualOpen((prev) => ({ ...prev, [block.category.id]: !open }))
                        }
                        onChanged={refetchAll}
                      >
                        <CourseRows
                          rows={block.rows}
                          selectedCourseId={courseId}
                          actions={{
                            onEdit: (row) => setSheet({ kind: 'edit', course: row.course }),
                            onAssign: (row) => setAssignCourseId(row.course.id),
                            onWithdraw: withdraw,
                          }}
                        />
                      </CategorySection>
                    </Reveal>
                  );
                })
              )}

              <InactiveCoursesSection
                curriculumId={curriculumId}
                categories={curriculumCategories}
                onChanged={refetchAll}
              />
            </>
          )}
        </>
      )}
      {inScope && curriculumId && loaded && (
        <CourseEditSheet
          target={sheet}
          onClose={() => setSheet(null)}
          curriculumId={curriculumId}
          curriculumLabel={curricula.find((c) => c.id === curriculumId)?.label ?? ''}
          categories={curriculumCategories}
          coursesInCurriculum={activeCoursesInCurriculum}
          requirements={(requirementsQuery.data ?? []).filter(
            (r) => r.curriculumId === curriculumId,
          )}
          prerequisites={prerequisitesQuery.data ?? []}
          onChanged={refetchAll}
        />
      )}
      {inScope && loaded && (
        <AssignInstructorSheet
          course={activeCoursesInCurriculum.find((c) => c.id === assignCourseId) ?? null}
          assignedUserIds={
            new Set(
              (assignmentsQuery.data ?? [])
                .filter((a) => a.courseId === assignCourseId)
                .map((a) => a.userId),
            )
          }
          instructors={instructorsQuery.data ?? []}
          onClose={() => setAssignCourseId(null)}
          onChanged={refetchAll}
        />
      )}
    </DashboardShell>
  );
}
