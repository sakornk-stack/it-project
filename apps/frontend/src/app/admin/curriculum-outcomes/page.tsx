'use client';

import { Suspense, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCheck, ListChecks, Plus, Search } from 'lucide-react';
import type { CloDetail } from '@eduanalyze-ai/shared-types';
import { fetchCourses } from '@/lib/api/academic-record';
import {
  fetchAllClos,
  fetchCurriculumMappings,
  fetchCurriculumPlos,
  updateClo,
} from '@/lib/api/curriculum-outcomes';
import { useAuth } from '@/lib/auth-context';
import { useCurriculumDirectory } from '@/lib/use-curriculum-directory';
import { useConfirm } from '@/lib/use-confirm';
import { useToast } from '@/lib/toast-context';
import { cn } from '@/lib/utils';
import { AuthLoadingScreen } from '@/components/auth/auth-loading-screen';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-states';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CloPanel, type CloPanelTarget } from '@/components/admin/clo-panel';
import { cloConfirmTitle, describeCloError } from '@/components/admin/clo-edit';
import { PloTab } from '@/components/admin/plo-tab';
import { plosOfCurriculum } from '@/components/admin/plo-edit';
import {
  CloCard,
  CourseHeading,
  CourseListItemButton,
  EffectNote,
  EmptyPane,
  StatsStrip,
  UnderlineTabs,
} from '@/components/admin/outcomes-panels';
import {
  cloCards,
  courseRows,
  filterCourseRows,
  outcomeStats,
  ploChips,
} from '@/components/admin/outcomes-view';

type Tab = 'courses' | 'plos';

export default function AdminCurriculumOutcomesPage() {
  return (
    /* useSearchParams requires a Suspense boundary in the App Router */
    <Suspense fallback={<AuthLoadingScreen />}>
      <OutcomesContent />
    </Suspense>
  );
}

function OutcomesContent() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { confirm, dialog } = useConfirm();
  const directoryQuery = useCurriculumDirectory();
  const entries = directoryQuery.data?.entries ?? [];
  const requested = searchParams.get('curriculum');
  const entry = entries.find((e) => e.curriculumId === requested) ?? entries[0] ?? null;
  const curriculumId = entry?.curriculumId ?? null;

  const coursesQuery = useQuery({ queryKey: ['courses'], queryFn: fetchCourses });
  const closQuery = useQuery({ queryKey: ['clos', 'all'], queryFn: fetchAllClos });
  const plosQuery = useQuery({
    queryKey: ['plos', 'curriculum', curriculumId],
    queryFn: () => fetchCurriculumPlos(curriculumId as string),
    enabled: curriculumId !== null,
  });
  const mappingsQuery = useQuery({
    queryKey: ['clo-plo-mappings', curriculumId],
    queryFn: () => fetchCurriculumMappings(curriculumId as string),
    enabled: curriculumId !== null,
  });

  const [tab, setTab] = useState<Tab>('courses');
  const [courseId, setCourseId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyUnconfirmed, setOnlyUnconfirmed] = useState(false);
  const [panel, setPanel] = useState<CloPanelTarget | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const allClos = closQuery.data;
  const rows = useMemo(
    () => courseRows(coursesQuery.data ?? [], allClos ?? [], curriculumId ?? ''),
    [coursesQuery.data, allClos, curriculumId],
  );
  const visibleRows = filterCourseRows(rows, search, onlyUnconfirmed);
  const selected = rows.find((r) => r.course.id === courseId) ?? null;
  const plos = plosOfCurriculum(plosQuery.data ?? [], curriculumId ?? '');
  const mappings = mappingsQuery.data ?? [];
  const cards = selected ? cloCards(allClos ?? [], selected.course.id, onlyUnconfirmed) : [];

  if (!user) return <AuthLoadingScreen />;

  const loadError =
    coursesQuery.isError || closQuery.isError || plosQuery.isError || mappingsQuery.isError;
  const loading =
    directoryQuery.isLoading ||
    coursesQuery.isLoading ||
    closQuery.isLoading ||
    plosQuery.isLoading;
  const label = entry
    ? `${entry.programName} · ${entry.programCode} ฉบับ ${entry.version} (พ.ศ. ${entry.effectiveYear})`
    : '';

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['clos'] });
    void queryClient.invalidateQueries({ queryKey: ['plos'] });
    void queryClient.invalidateQueries({ queryKey: ['clo-plo-mappings'] });
  }

  function pickCurriculum(id: string) {
    setCourseId(null);
    setActionError(null);
    router.replace(`${pathname}?curriculum=${id}`);
  }

  // Flow that writes: PATCH /clos/:id with isConfirmed=true, once per CLO that needs it
  async function confirmClos(targets: CloDetail[], title: string) {
    const ok = await confirm({
      title,
      description: `ยืนยันว่าตรวจ CLO ที่เลือกแล้ว (${targets.length} รายการ) ป้าย "ยังไม่ยืนยัน" จะหายไป`,
      confirmLabel: 'ยืนยัน',
    });
    if (!ok) return;
    setBusy(title);
    setActionError(null);
    let done = 0;
    try {
      for (const clo of targets) {
        await updateClo(clo.id, { isConfirmed: true });
        done += 1;
      }
      toast.success(`ยืนยันแล้ว ${done} รายการ`);
    } catch (error) {
      setActionError(
        `${describeCloError(error)} — ยืนยันสำเร็จแล้ว ${done} จาก ${targets.length} รายการ`,
      );
    } finally {
      setBusy(null);
      refresh();
    }
  }

  const unconfirmedOfCourse = selected
    ? (allClos ?? []).filter((c) => c.courseId === selected.course.id && !c.isConfirmed)
    : [];

  return (
    <DashboardShell role="ADMIN" identityLabel={user.email} fullName={user.fullName}>
      <PageHeader
        title="จัดการ CLO/PLO"
        description="เพิ่ม แก้ ลบ CLO ของแต่ละรายวิชา และกำหนดว่า CLO ไหนตอบ PLO ข้อไหน"
      />

      {directoryQuery.isError && <PageLoadError onRetry={() => directoryQuery.refetch()} />}
      {loadError && (
        <PageLoadError
          message="โหลดข้อมูลไม่สำเร็จ"
          onRetry={() => {
            void coursesQuery.refetch();
            void closQuery.refetch();
            void plosQuery.refetch();
            void mappingsQuery.refetch();
          }}
        />
      )}
      {loading && <Skeleton className="h-40 w-full" />}
      {directoryQuery.isSuccess && entries.length === 0 && (
        <EmptyState icon={ListChecks} description="ยังไม่มีหลักสูตรในขอบเขตที่คุณดูแล" />
      )}

      {entry && !loading && !loadError && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="w-full max-w-xl space-y-1.5">
              <label htmlFor="outcomes-curriculum" className="text-sm font-medium">
                หลักสูตร
              </label>
              <Select value={entry.curriculumId} onValueChange={pickCurriculum}>
                <SelectTrigger id="outcomes-curriculum" className="h-auto text-left">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {entries.map((e) => (
                    <SelectItem key={e.curriculumId} value={e.curriculumId} className="min-h-11">
                      {e.programName} · {e.programCode} ฉบับ {e.version} (พ.ศ. {e.effectiveYear})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <EffectNote />
          </div>

          <StatsStrip stats={outcomeStats(rows)} />

          <UnderlineTabs
            value={tab}
            onChange={setTab}
            tabs={
              [
                ['courses', 'ตามรายวิชา'],
                ['plos', `PLO ของหลักสูตร (${plos.length})`],
              ] as const
            }
          />

          {tab === 'plos' && (
            <PloTab
              curriculumId={entry.curriculumId}
              curriculumLabel={label}
              plos={plos}
              mappings={mappings}
              onChanged={refresh}
            />
          )}

          {tab === 'courses' && (
            <div className="grid grid-cols-1 gap-6 lg:h-[max(32rem,calc(100dvh-24rem))] lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
              {/* On a phone the course list and the CLO cards take turns. */}
              <section
                aria-label="รายวิชา"
                className={cn(
                  'min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm lg:flex',
                  selected ? 'hidden' : 'flex',
                )}
              >
                <div className="space-y-2 border-b p-3">
                  <div className="relative">
                    <Search
                      size={16}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="ค้นหารหัสหรือชื่อวิชา"
                      aria-label="ค้นหารายวิชา"
                      className="pl-9"
                    />
                  </div>
                  <label className="flex min-h-9 items-center gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0"
                      checked={onlyUnconfirmed}
                      onChange={(e) => setOnlyUnconfirmed(e.target.checked)}
                    />
                    เฉพาะที่ยังไม่ยืนยัน
                  </label>
                </div>
                {visibleRows.length === 0 ? (
                  <EmptyPane title="ไม่พบรายวิชา" hint="ลองเปลี่ยนคำค้นหา หรือปิดตัวกรองด้านบน" />
                ) : (
                  <ul className="max-h-[70vh] min-h-0 flex-1 divide-y overflow-y-auto lg:max-h-none">
                    {visibleRows.map((row) => (
                      <li key={row.course.id}>
                        <CourseListItemButton
                          row={row}
                          active={row.course.id === courseId}
                          onSelect={() => {
                            setCourseId(row.course.id);
                            setActionError(null);
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section
                aria-label="CLO ของรายวิชา"
                className={cn(
                  'min-h-0 min-w-0 overflow-y-auto rounded-xl border bg-muted/30 lg:block',
                  selected ? 'block' : 'hidden',
                )}
              >
                {!selected && (
                  <EmptyPane
                    title="เลือกรายวิชาทางซ้าย"
                    hint="แล้วจะเห็น CLO ของวิชานั้น และ PLO ที่แต่ละ CLO ตอบ"
                  />
                )}
                {selected && (
                  <div className="space-y-4 p-4 sm:p-5">
                    <Button
                      variant="ghost"
                      className="-ml-3 gap-1.5 lg:hidden"
                      onClick={() => setCourseId(null)}
                    >
                      <ArrowLeft size={14} aria-hidden="true" />
                      เลือกวิชาอื่น
                    </Button>
                    <CourseHeading
                      course={selected.course}
                      cloCount={selected.cloCount}
                      actions={
                        <>
                          {unconfirmedOfCourse.length > 0 && (
                            <Button
                              variant="outline"
                              disabled={busy !== null}
                              onClick={() =>
                                confirmClos(
                                  unconfirmedOfCourse,
                                  `ยืนยัน CLO ทั้งวิชา ${selected.course.code}?`,
                                )
                              }
                            >
                              <CheckCheck size={16} aria-hidden="true" className="mr-1.5" />
                              ยืนยันทั้งวิชา
                            </Button>
                          )}
                          <Button onClick={() => setPanel({ kind: 'create' })}>
                            <Plus size={16} aria-hidden="true" className="mr-1.5" />
                            เพิ่ม CLO
                          </Button>
                        </>
                      }
                    />
                    {actionError && <ApiErrorAlert message={actionError} />}
                    {cards.length === 0 &&
                      (selected.cloCount === 0 ? (
                        <EmptyPane
                          title="วิชานี้ยังไม่มี CLO"
                          hint="เพิ่ม CLO แรกของวิชา แล้วเลือก PLO ที่ CLO นั้นตอบได้ในหน้าต่างเดียวกัน"
                          onAdd={() => setPanel({ kind: 'create' })}
                        />
                      ) : (
                        <EmptyPane
                          title="ยืนยันครบแล้ว"
                          hint="CLO ของวิชานี้ยืนยันครบทุกรายการ ปิดตัวกรองเพื่อดูทั้งหมด"
                        />
                      ))}
                    <ul className="space-y-3">
                      {cards.map((clo) => (
                        <li key={clo.id}>
                          <CloCard
                            clo={clo}
                            chips={ploChips(clo.id, mappings, plos)}
                            disabled={busy !== null}
                            onEdit={() => setPanel({ kind: 'edit', clo })}
                            onConfirm={() => confirmClos([clo], cloConfirmTitle(clo))}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </div>
          )}

          {selected && (
            <CloPanel
              target={panel}
              onClose={() => setPanel(null)}
              courseId={selected.course.id}
              courseLabel={`${selected.course.code} ${selected.course.name}`}
              plos={plos}
              mappings={mappings}
              onChanged={refresh}
            />
          )}
        </>
      )}
      {dialog}
    </DashboardShell>
  );
}
