'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ClipboardCheck, Star, Users } from 'lucide-react';
import { fetchCourses } from '@/lib/api/academic-record';
import {
  fetchCourseInstructors,
  fetchStaffOverview,
  fetchStaffStudentRisk,
  fetchStaffYearLevels,
} from '@/lib/api/staff';
import { useAuth } from '@/lib/auth-context';
import { countShare } from '@/lib/progress-ring-geometry';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { RequireRole } from '@/components/auth/require-role';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-states';
import { Reveal } from '@/components/layout/reveal';
import { RevealOnScroll } from '@/components/layout/reveal-on-scroll';
import { MetricCard } from '@/components/staff/metric-card';
import {
  CHECK_ICONS,
  OverviewChecklist,
  type ChecklistItem,
} from '@/components/staff/overview-checklist';
import { OverviewStatusBreakdown } from '@/components/staff/overview-status-breakdown';
import { OverviewYearTable } from '@/components/staff/overview-year-table';
import {
  coursesWithoutInstructor,
  readGroupGpa,
  sharePercent,
  summarizeByYearLevel,
  summarizeStudents,
  toRows,
} from '@/components/staff/staff-status';
import { YEAR_LEVELS, yearInfoFrom } from '@/components/staff/year-info';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { AnimatedRing } from '@/components/ui/animated-ring';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const ALL_CURRICULA = 'ALL';

export default function StaffDashboardPage() {
  return (
    <ProtectedRoute>
      <RequireRole role="STAFF">
        <StaffDashboardContent />
      </RequireRole>
    </ProtectedRoute>
  );
}

function StaffDashboardContent() {
  const { user } = useAuth();
  const [scope, setScope] = useState(ALL_CURRICULA);

  // One request each for the whole page; nothing here is fetched per course.
  const studentsQuery = useQuery({
    queryKey: ['staff-student-risk'],
    queryFn: fetchStaffStudentRisk,
  });
  const yearsQuery = useQuery({
    queryKey: ['staff-year-levels'],
    queryFn: fetchStaffYearLevels,
  });
  const overviewQuery = useQuery({
    queryKey: ['staff-overview'],
    queryFn: fetchStaffOverview,
  });
  const coursesQuery = useQuery({
    queryKey: ['courses'],
    queryFn: fetchCourses,
  });
  const assignmentsQuery = useQuery({
    queryKey: ['course-instructors'],
    queryFn: fetchCourseInstructors,
  });

  const curricula = useMemo(
    () =>
      (overviewQuery.data?.programs ?? []).flatMap((program) =>
        program.curricula.map((curriculum) => ({
          id: curriculum.curriculumId,
          label: `${program.programCode} ${program.programName} · ฉบับ ${curriculum.version}`,
          coursesWithoutClo: curriculum.coursesWithoutClo,
        })),
      ),
    [overviewQuery.data],
  );

  const view = useMemo(() => {
    if (!studentsQuery.data || !yearsQuery.data) return null;
    const inScope = studentsQuery.data.filter(
      (s) => scope === ALL_CURRICULA || s.curriculumId === scope,
    );
    const yearInfo = yearInfoFrom(yearsQuery.data);
    const rows = toRows(inScope, yearInfo.levelById);
    const summary = summarizeStudents(inScope);
    const years = summarizeByYearLevel(rows, yearInfo.behindIds, YEAR_LEVELS);
    return {
      summary,
      years,
      totalBehind: years.reduce((sum, y) => sum + y.behind, 0),
    };
  }, [studentsQuery.data, yearsQuery.data, scope]);

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

  const scopeIds = new Set(scope === ALL_CURRICULA ? curricula.map((c) => c.id) : [scope]);
  const checklist: ChecklistItem[] = [];
  if (view) {
    const { summary } = view;
    if (summary.byStatus.NO_DATA > 0) {
      checklist.push({
        key: 'no-data',
        icon: CHECK_ICONS.noData,
        tone: 'neutral',
        title: `นิสิตที่ยังไม่มีข้อมูลผลการเรียน ${summary.byStatus.NO_DATA} คน`,
        description: 'ดูรายชื่อเพื่อตรวจว่ายังไม่ได้บันทึกผลการเรียน',
        action: { href: '/staff/students?risk=NO_DATA', label: 'ดูรายชื่อ' },
      });
    }
    if (summary.byStatus.CRITICAL > 0) {
      checklist.push({
        key: 'critical',
        icon: CHECK_ICONS.critical,
        tone: 'danger',
        title: `นิสิตที่อยู่ในระดับเร่งด่วน ${summary.byStatus.CRITICAL} คน`,
        description: 'GPA สะสมต่ำกว่า 1.50',
        action: { href: '/staff/students?risk=CRITICAL', label: 'ดูรายชื่อ' },
      });
    }
  }
  if (coursesQuery.data && assignmentsQuery.data && curricula.length > 0) {
    const missing = coursesWithoutInstructor(coursesQuery.data, assignmentsQuery.data, scopeIds);
    if (missing.length > 0) {
      const firstCurriculum = curricula.find((c) => missing.some((m) => m.curriculumId === c.id));
      const inCurricula = new Set(missing.map((m) => m.curriculumId)).size;
      checklist.push({
        key: 'no-instructor',
        icon: CHECK_ICONS.noInstructor,
        tone: 'warning',
        title: `วิชาที่ยังไม่มีอาจารย์ผู้รับผิดชอบ ${missing.length} วิชา`,
        description:
          inCurricula > 1
            ? `อยู่ใน ${inCurricula} หลักสูตร ไปที่หลักสูตรที่มีวิชารอมอบหมาย`
            : 'เปิดหน้าหลักสูตรเพื่อมอบหมายอาจารย์ผู้รับผิดชอบวิชา',
        action: {
          href: `/staff/curriculum?curriculumId=${firstCurriculum?.id ?? ''}&instructor=none`,
          label: 'ดูรายวิชา',
        },
      });
    }
  }
  const withoutClo = curricula
    .filter((c) => scopeIds.has(c.id))
    .reduce((sum, c) => sum + c.coursesWithoutClo, 0);
  if (withoutClo > 0) {
    // Information only: CLOs are set by ADMIN, so there is nothing for Staff to open.
    checklist.push({
      key: 'no-clo',
      icon: CHECK_ICONS.noClo,
      tone: 'neutral',
      title: `วิชาที่ยังไม่มี CLO ${withoutClo} วิชา`,
      description:
        'CLO ของรายวิชากำหนดโดยผู้ดูแลระบบ (ADMIN) หากมีวิชาที่ยังไม่มี CLO กรุณาแจ้งผู้ดูแลระบบให้เพิ่ม',
    });
  }

  const group = view ? readGroupGpa(view.summary.averageGpa, view.summary.withGpa) : null;
  const loadFailed = studentsQuery.isError || yearsQuery.isError || overviewQuery.isError;

  return (
    <DashboardShell role="STAFF" identityLabel={user.email} fullName={user.fullName}>
      <Reveal index={0}>
        <PageHeader
          title="ภาพรวมการศึกษาและผลการเรียน"
          description="สรุปผลการเรียนและนิสิตที่ต้องติดตามในขอบเขตที่คุณดูแล"
          actions={
            <label className="block space-y-1.5 sm:w-80">
              <span className="text-xs font-medium text-muted-foreground">
                หลักสูตรและสาขาวิชาที่ดูแล
              </span>
              <Select value={scope} onValueChange={setScope} disabled={curricula.length === 0}>
                <SelectTrigger aria-label="เลือกหลักสูตรที่ต้องการดู">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_CURRICULA}>ทุกหลักสูตรในความดูแล</SelectItem>
                  {curricula.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          }
        />
      </Reveal>

      {loadFailed && (
        <PageLoadError
          onRetry={() => {
            studentsQuery.refetch();
            yearsQuery.refetch();
            overviewQuery.refetch();
          }}
        />
      )}

      {!view && !loadFailed && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {view && group && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Reveal index={1} className="h-full">
              <MetricCard
                icon={Users}
                label="นิสิตในความดูแล"
                value={<AnimatedNumber value={view.summary.active} />}
                unit="คน"
                note={`ไม่นับนิสิตที่ระงับ ${view.summary.suspended} คน`}
              />
            </Reveal>
            <Reveal index={2} className="h-full">
              <MetricCard
                icon={Star}
                label="GPA เฉลี่ย"
                value={
                  group.kind === 'ok' ? (
                    <AnimatedNumber
                      value={view.summary.averageGpa}
                      decimals={2}
                      format={(n) => n.toFixed(2)}
                    />
                  ) : (
                    '—'
                  )
                }
                unit={group.value ? '/ 4.00' : undefined}
                note={group.note}
              />
            </Reveal>
            <Reveal index={3} className="h-full">
              <MetricCard
                icon={ClipboardCheck}
                label="มีผลการเรียน"
                value={<AnimatedNumber value={view.summary.withRecords} />}
                unit={`คน จาก ${view.summary.active} คน`}
                visual={
                  countShare(view.summary.withRecords, view.summary.active) === null ? undefined : (
                    <AnimatedRing
                      percent={countShare(view.summary.withRecords, view.summary.active) ?? 0}
                      size={64}
                      strokeWidth={7}
                    >
                      <span className="text-[11px] font-semibold tabular-nums text-primary">
                        {view.summary.withRecords}/{view.summary.active}
                      </span>
                    </AnimatedRing>
                  )
                }
                note={`คิดเป็น ${sharePercent(view.summary.withRecords, view.summary.active)} ของนิสิตที่ใช้งานอยู่`}
              />
            </Reveal>
          </div>

          {view.summary.active === 0 ? (
            <Reveal index={4}>
              <Card>
                <CardContent className="pt-6">
                  <EmptyState
                    icon={Users}
                    description={
                      scope === ALL_CURRICULA
                        ? 'ยังไม่มีนิสิตที่ใช้งานอยู่ในขอบเขตที่คุณดูแล (ไม่นับนิสิตที่ถูกระงับ) เชิญนิสิตเข้าระบบ หรือติดต่อผู้ดูแลระบบหากขอบเขตของคุณยังไม่ถูกกำหนด'
                        : 'หลักสูตรที่เลือกยังไม่มีนิสิตที่ใช้งานอยู่ ลองเลือก “ทุกหลักสูตรในความดูแล” จากรายการด้านบน'
                    }
                    action={
                      scope === ALL_CURRICULA ? (
                        <Link
                          href="/staff/student-invitations"
                          className="inline-flex min-h-11 items-center rounded border border-slate-300 px-4 text-sm font-semibold text-primary hover:bg-slate-100"
                        >
                          ไปที่คำเชิญนิสิต
                        </Link>
                      ) : undefined
                    }
                  />
                </CardContent>
              </Card>
            </Reveal>
          ) : (
            <Reveal index={4} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <OverviewYearTable
                  years={view.years}
                  total={view.summary}
                  totalBehind={view.totalBehind}
                />
              </div>
              <OverviewStatusBreakdown summary={view.summary} />
            </Reveal>
          )}

          <RevealOnScroll>
            <OverviewChecklist items={checklist} />
          </RevealOnScroll>
        </>
      )}
    </DashboardShell>
  );
}
