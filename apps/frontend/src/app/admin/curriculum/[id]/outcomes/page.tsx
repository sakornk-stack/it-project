'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ListChecks, Pencil, Plus } from 'lucide-react';
import type { CloDetail } from '@eduanalyze-ai/shared-types';
import { fetchCourses } from '@/lib/api/academic-record';
import { fetchCourseClos, updateClo } from '@/lib/api/curriculum-outcomes';
import { findCurriculum } from '@/lib/admin-curricula';
import { useAuth } from '@/lib/auth-context';
import { useCurriculumDirectory } from '@/lib/use-curriculum-directory';
import { useConfirm } from '@/lib/use-confirm';
import { useToast } from '@/lib/toast-context';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ApiErrorAlert, WARNING_ALERT_CLASS } from '@/components/ui/api-error-alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { StaffCombobox } from '@/components/staff/staff-combobox';
import { CloEditSheet, type CloSheetTarget } from '@/components/admin/clo-edit-sheet';
import {
  CLO_EFFECT_WARNING,
  cloConfirmTitle,
  describeCloError,
  sortClos,
  unconfirmedCount,
} from '@/components/admin/clo-edit';

export default function AdminCurriculumOutcomesPage() {
  const { id } = useParams<{ id: string }>();
  return <OutcomesContent curriculumId={id} />;
}

function OutcomesContent({ curriculumId }: Readonly<{ curriculumId: string }>) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const overviewQuery = useCurriculumDirectory();
  const coursesQuery = useQuery({
    queryKey: ['courses'],
    queryFn: fetchCourses,
  });
  const [courseId, setCourseId] = useState<string | undefined>(undefined);
  const [sheet, setSheet] = useState<CloSheetTarget | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const courses = useMemo(
    () =>
      (coursesQuery.data ?? [])
        .filter((c) => c.curriculumId === curriculumId)
        .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true })),
    [coursesQuery.data, curriculumId],
  );
  const course = courses.find((c) => c.id === courseId) ?? null;
  const closQuery = useQuery({
    queryKey: ['clos', 'course', courseId],
    queryFn: () => fetchCourseClos(courseId as string),
    enabled: courseId !== undefined,
  });
  const clos = sortClos(closQuery.data ?? []);
  const entry = overviewQuery.data
    ? findCurriculum(overviewQuery.data.entries, curriculumId)
    : null;
  const outOfScope = overviewQuery.data !== undefined && entry === null;

  if (!user) return null;

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['clos'] });
  }

  // Flow that writes: PATCH /clos/:id with isConfirmed=true only
  async function handleConfirm(clo: CloDetail) {
    const ok = await confirm({
      title: cloConfirmTitle(clo),
      description: `ยืนยันว่าตรวจสอบ ${clo.code} แล้ว ป้าย "ยังไม่ยืนยัน" จะหายไป`,
      confirmLabel: 'ยืนยัน',
    });
    if (!ok) return;
    setBusyId(clo.id);
    setActionError(null);
    try {
      await updateClo(clo.id, { isConfirmed: true });
      toast.success(`ยืนยัน ${clo.code} แล้ว`);
      refresh();
    } catch (error) {
      setActionError(describeCloError(error));
    } finally {
      setBusyId(null);
    }
  }

  const courseOptions = courses.map((c) => ({
    value: c.id,
    label: `${c.code} ${c.name}`,
    searchText: `${c.code} ${c.name} ${c.nameEn ?? ''}`,
  }));
  const pending = unconfirmedCount(clos);

  return (
    <DashboardShell role="ADMIN" identityLabel={user.email} fullName={user.fullName}>
      <Link
        href={`/admin/curriculum/${curriculumId}`}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        กลับไปคุณภาพหลักสูตร
      </Link>

      {outOfScope && <PageLoadError message="ไม่พบหลักสูตรนี้ในขอบเขตที่คุณดูแล" />}
      {!outOfScope && (overviewQuery.isLoading || coursesQuery.isLoading) && (
        <Skeleton className="h-28 w-full" />
      )}
      {coursesQuery.isError && (
        <PageLoadError message="โหลดรายวิชาไม่สำเร็จ" onRetry={() => coursesQuery.refetch()} />
      )}

      {entry && (
        <PageHeader
          title="CLO รายวิชา"
          description={`${entry.programName} · ${entry.programCode} ฉบับ ${entry.version} (พ.ศ. ${entry.effectiveYear})`}
        />
      )}

      {entry && courses.length === 0 && !coursesQuery.isLoading && (
        <Card>
          <CardContent className="pt-6">
            <EmptyState icon={ListChecks} description="หลักสูตรนี้ยังไม่มีรายวิชา" />
          </CardContent>
        </Card>
      )}

      {entry && courses.length > 0 && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Alert className={WARNING_ALERT_CLASS}>
              <AlertDescription>{CLO_EFFECT_WARNING}</AlertDescription>
            </Alert>
            <div className="space-y-1.5">
              <label htmlFor="outcomes-course" className="text-sm font-medium">
                เลือกรายวิชา
              </label>
              <StaffCombobox
                id="outcomes-course"
                options={courseOptions}
                value={courseId}
                onValueChange={(v) => {
                  setCourseId(v);
                  setActionError(null);
                }}
                placeholder="เลือกรายวิชา"
                searchPlaceholder="ค้นหารหัสหรือชื่อวิชา"
              />
            </div>

            {course && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-primary">
                    {course.code} {course.name}
                  </h2>
                  <Button onClick={() => setSheet({ kind: 'create' })}>
                    <Plus size={16} aria-hidden="true" className="mr-1.5" />
                    เพิ่ม CLO
                  </Button>
                </div>
                {pending > 0 && (
                  <p className="text-sm text-muted-foreground">
                    มี {pending} CLO ที่ยังไม่ยืนยัน (คัดลอกมาจากหลักสูตรฉบับอื่น)
                  </p>
                )}
                {actionError && <ApiErrorAlert message={actionError} />}
                {closQuery.isLoading && <Skeleton className="h-24 w-full" />}
                {closQuery.isError && (
                  <PageLoadError message="โหลด CLO ไม่สำเร็จ" onRetry={() => closQuery.refetch()} />
                )}
                {closQuery.isSuccess && clos.length === 0 && (
                  <EmptyState icon={ListChecks} description="รายวิชานี้ยังไม่มี CLO" />
                )}
                <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
                  {clos.map((clo) => (
                    <li key={clo.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{clo.code}</span>
                          {!clo.isConfirmed && <Badge tone="warning">ยังไม่ยืนยัน</Badge>}
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {clo.achievementThreshold === null
                              ? 'เกณฑ์ผ่าน: ตามหลักสูตร'
                              : `เกณฑ์ผ่าน: ร้อยละ ${clo.achievementThreshold}`}
                          </span>
                        </div>
                        <p className="break-words text-sm">{clo.description}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {!clo.isConfirmed && (
                          <Button
                            variant="outline"
                            disabled={busyId === clo.id}
                            onClick={() => handleConfirm(clo)}
                          >
                            {busyId === clo.id ? 'กำลังยืนยัน...' : 'ยืนยัน'}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          aria-label={`แก้ไข ${clo.code}`}
                          onClick={() => setSheet({ kind: 'edit', clo })}
                        >
                          <Pencil size={14} aria-hidden="true" className="mr-1.5" />
                          แก้ไข
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {course && (
        <CloEditSheet
          target={sheet}
          onClose={() => setSheet(null)}
          courseId={course.id}
          courseLabel={`${course.code} ${course.name}`}
          onChanged={refresh}
        />
      )}
      {dialog}
    </DashboardShell>
  );
}
