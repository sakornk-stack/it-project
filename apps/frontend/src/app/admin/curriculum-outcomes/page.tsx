'use client';

import { Suspense, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCheck, ListChecks, Pencil, Plus, Search } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ApiErrorAlert, WARNING_ALERT_CLASS } from '@/components/ui/api-error-alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  COURSE_FLAG_LABELS,
  OUTCOME_EFFECT_WARNING,
  chipLabel,
  cloCards,
  courseFlag,
  courseRows,
  filterCourseRows,
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
          <div className="space-y-4">
            <div className="max-w-xl space-y-1.5">
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
            <Alert className={WARNING_ALERT_CLASS}>
              <AlertDescription>{OUTCOME_EFFECT_WARNING}</AlertDescription>
            </Alert>
          </div>

          <div
            role="tablist"
            aria-label="เลือกดู"
            className="flex flex-wrap gap-1 rounded-lg border bg-card p-1 sm:w-fit"
          >
            {(
              [
                ['courses', 'ตามรายวิชา'],
                ['plos', `PLO ของหลักสูตร (${plos.length})`],
              ] as const
            ).map(([value, text]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={cn(
                  'min-h-11 flex-1 rounded-md px-3.5 text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none sm:flex-none',
                  tab === value
                    ? 'bg-brand text-brand-foreground'
                    : 'text-muted-foreground hover:bg-slate-50',
                )}
              >
                {text}
              </button>
            ))}
          </div>

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
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
              {/* On a phone the course list and the CLO cards take turns. */}
              <section
                aria-label="รายวิชา"
                className={cn('space-y-3', selected ? 'hidden lg:block' : 'block')}
              >
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
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0"
                    checked={onlyUnconfirmed}
                    onChange={(e) => setOnlyUnconfirmed(e.target.checked)}
                  />
                  เฉพาะที่ยังไม่ยืนยัน
                </label>
                {visibleRows.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    ไม่พบรายวิชาที่ตรงกัน
                  </p>
                ) : (
                  <ul className="max-h-[70vh] divide-y divide-slate-200 overflow-y-auto rounded-lg border border-slate-200 bg-card">
                    {visibleRows.map((row) => {
                      const flag = courseFlag(row);
                      const active = row.course.id === courseId;
                      return (
                        <li key={row.course.id}>
                          <button
                            type="button"
                            aria-current={active ? 'true' : undefined}
                            onClick={() => {
                              setCourseId(row.course.id);
                              setActionError(null);
                            }}
                            className={cn(
                              'flex min-h-11 w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-slate-50',
                              active && 'bg-slate-50 ring-2 ring-inset ring-brand',
                            )}
                          >
                            <span className="flex items-start justify-between gap-2">
                              <span className="min-w-0 break-words text-sm">
                                <span className="font-semibold">{row.course.code}</span>{' '}
                                {row.course.name}
                              </span>
                              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                {row.cloCount} CLO
                              </span>
                            </span>
                            {flag && (
                              <Badge tone="warning" className="self-start">
                                {COURSE_FLAG_LABELS[flag]}
                              </Badge>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section
                aria-label="CLO ของรายวิชา"
                className={cn('min-w-0 space-y-4', selected ? 'block' : 'hidden lg:block')}
              >
                {!selected && (
                  <EmptyState icon={ListChecks} description="เลือกรายวิชาทางซ้ายเพื่อดู CLO" />
                )}
                {selected && (
                  <>
                    <Button
                      variant="ghost"
                      className="-ml-3 gap-1.5 lg:hidden"
                      onClick={() => setCourseId(null)}
                    >
                      <ArrowLeft size={14} aria-hidden="true" />
                      เลือกวิชาอื่น
                    </Button>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h2 className="min-w-0 break-words text-lg font-semibold text-primary">
                        {selected.course.code} {selected.course.name}
                      </h2>
                      <div className="flex flex-wrap gap-2">
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
                      </div>
                    </div>
                    {actionError && <ApiErrorAlert message={actionError} />}
                    {cards.length === 0 && (
                      <EmptyState
                        icon={ListChecks}
                        description={
                          onlyUnconfirmed && selected.cloCount > 0
                            ? 'CLO ของวิชานี้ยืนยันครบแล้ว'
                            : 'รายวิชานี้ยังไม่มี CLO'
                        }
                      />
                    )}
                    <ul className="space-y-3">
                      {cards.map((clo) => {
                        const chips = ploChips(clo.id, mappings, plos);
                        return (
                          <li key={clo.id}>
                            <Card>
                              <CardContent className="space-y-3 p-4 sm:p-5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold">{clo.code}</span>
                                  <Badge tone={clo.isConfirmed ? 'success' : 'warning'}>
                                    {clo.isConfirmed ? 'ยืนยันแล้ว' : 'ยังไม่ยืนยัน'}
                                  </Badge>
                                  <span className="text-xs tabular-nums text-muted-foreground">
                                    {clo.achievementThreshold === null
                                      ? 'เกณฑ์ผ่าน: ตามหลักสูตร'
                                      : `เกณฑ์ผ่าน: ร้อยละ ${clo.achievementThreshold}`}
                                  </span>
                                </div>
                                <p className="break-words text-sm">{clo.description}</p>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-xs text-muted-foreground">PLO ที่ตอบ:</span>
                                  {chips.length === 0 ? (
                                    <span className="text-xs text-muted-foreground">
                                      ยังไม่ได้เลือก
                                    </span>
                                  ) : (
                                    chips.map((chip) => (
                                      <Badge key={chip.ploId} tone="neutral">
                                        {chipLabel(chip)}
                                      </Badge>
                                    ))
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    variant="outline"
                                    aria-label={`แก้ไข ${clo.code}`}
                                    onClick={() => setPanel({ kind: 'edit', clo })}
                                  >
                                    <Pencil size={14} aria-hidden="true" className="mr-1.5" />
                                    แก้ไข
                                  </Button>
                                  {!clo.isConfirmed && (
                                    <Button
                                      variant="outline"
                                      disabled={busy !== null}
                                      onClick={() => confirmClos([clo], cloConfirmTitle(clo))}
                                    >
                                      ยืนยัน
                                    </Button>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          </li>
                        );
                      })}
                    </ul>
                  </>
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
