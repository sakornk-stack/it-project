'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Link2, ListChecks, Pencil, Plus } from 'lucide-react';
import { fetchCurriculumMappings, fetchCurriculumPlos } from '@/lib/api/curriculum-outcomes';
import { findCurriculum } from '@/lib/admin-curricula';
import { useAuth } from '@/lib/auth-context';
import { useCurriculumDirectory } from '@/lib/use-curriculum-directory';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WARNING_ALERT_CLASS } from '@/components/ui/api-error-alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { PloEditSheet, type PloSheetTarget } from '@/components/admin/plo-edit-sheet';
import { OUTCOME_EFFECT_WARNING, plosOfCurriculum } from '@/components/admin/plo-edit';

export default function AdminCurriculumPlosPage() {
  const { id } = useParams<{ id: string }>();
  return <PlosContent curriculumId={id} />;
}

function PlosContent({ curriculumId }: Readonly<{ curriculumId: string }>) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const overviewQuery = useCurriculumDirectory();
  const plosQuery = useQuery({
    queryKey: ['plos', 'curriculum', curriculumId],
    queryFn: () => fetchCurriculumPlos(curriculumId),
  });
  const mappingsQuery = useQuery({
    queryKey: ['clo-plo-mappings', curriculumId],
    queryFn: () => fetchCurriculumMappings(curriculumId),
  });
  const [sheet, setSheet] = useState<PloSheetTarget | null>(null);

  const plos = plosOfCurriculum(plosQuery.data ?? [], curriculumId);
  const linkCount = (ploId: string) =>
    (mappingsQuery.data ?? []).filter((m) => m.ploId === ploId).length;
  const entry = overviewQuery.data
    ? findCurriculum(overviewQuery.data.entries, curriculumId)
    : null;
  const outOfScope = overviewQuery.data !== undefined && entry === null;

  if (!user) return null;

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['plos'] });
    void queryClient.invalidateQueries({ queryKey: ['clo-plo-mappings'] });
  }

  const label = entry
    ? `${entry.programName} · ${entry.programCode} ฉบับ ${entry.version} (พ.ศ. ${entry.effectiveYear})`
    : '';

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
      {!outOfScope && (overviewQuery.isLoading || plosQuery.isLoading) && (
        <Skeleton className="h-28 w-full" />
      )}
      {plosQuery.isError && (
        <PageLoadError message="โหลด PLO ไม่สำเร็จ" onRetry={() => plosQuery.refetch()} />
      )}

      {entry && <PageHeader title="PLO ของหลักสูตร" description={label} />}

      {entry && plosQuery.isSuccess && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Alert className={WARNING_ALERT_CLASS}>
              <AlertDescription>{OUTCOME_EFFECT_WARNING}</AlertDescription>
            </Alert>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href={`/admin/curriculum/${curriculumId}/mappings`}
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <Link2 size={14} aria-hidden="true" />
                เชื่อม CLO↔PLO
              </Link>
              <Button onClick={() => setSheet({ kind: 'create' })}>
                <Plus size={16} aria-hidden="true" className="mr-1.5" />
                เพิ่ม PLO
              </Button>
            </div>
            {plos.length === 0 && (
              <EmptyState icon={ListChecks} description="หลักสูตรนี้ยังไม่มี PLO" />
            )}
            <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
              {plos.map((plo) => (
                <li key={plo.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{plo.code}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {mappingsQuery.isSuccess
                          ? `เชื่อมกับ CLO ${linkCount(plo.id)} รายการ`
                          : 'กำลังนับการเชื่อมโยง...'}
                      </span>
                    </div>
                    <p className="break-words text-sm font-medium">{plo.name}</p>
                    {plo.description && (
                      <p className="break-words text-sm text-muted-foreground">{plo.description}</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    aria-label={`แก้ไข ${plo.code}`}
                    onClick={() => setSheet({ kind: 'edit', plo })}
                  >
                    <Pencil size={14} aria-hidden="true" className="mr-1.5" />
                    แก้ไข
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <PloEditSheet
        target={sheet}
        onClose={() => setSheet(null)}
        curriculumId={curriculumId}
        curriculumLabel={label}
        onChanged={refresh}
      />
    </DashboardShell>
  );
}
