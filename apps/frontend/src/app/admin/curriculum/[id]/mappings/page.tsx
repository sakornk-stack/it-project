'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ListChecks } from 'lucide-react';
import { fetchCourses } from '@/lib/api/academic-record';
import {
  createMapping,
  deleteMapping,
  fetchCourseClos,
  fetchCurriculumMappings,
  fetchCurriculumPlos,
  updateMapping,
} from '@/lib/api/curriculum-outcomes';
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
import { Button } from '@/components/ui/button';
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
import { StaffCombobox } from '@/components/staff/staff-combobox';
import { closOfCourse } from '@/components/admin/clo-edit';
import { OUTCOME_EFFECT_WARNING, plosOfCurriculum } from '@/components/admin/plo-edit';
import {
  MAPPING_SAVE_NOTE,
  WEIGHT_OPTIONS,
  describeMappingError,
  diffCount,
  diffMappings,
  diffSummary,
  draftFromMappings,
  mappingKey,
  setLinked,
  setWeight,
  type MappingDraft,
} from '@/components/admin/mapping-edit';

export default function AdminCurriculumMappingsPage() {
  const { id } = useParams<{ id: string }>();
  return <MappingsContent curriculumId={id} />;
}

function MappingsContent({ curriculumId }: Readonly<{ curriculumId: string }>) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const overviewQuery = useCurriculumDirectory();
  const coursesQuery = useQuery({ queryKey: ['courses'], queryFn: fetchCourses });
  const plosQuery = useQuery({
    queryKey: ['plos', 'curriculum', curriculumId],
    queryFn: () => fetchCurriculumPlos(curriculumId),
  });
  const mappingsQuery = useQuery({
    queryKey: ['clo-plo-mappings', curriculumId],
    queryFn: () => fetchCurriculumMappings(curriculumId),
  });
  const [courseId, setCourseId] = useState<string | undefined>(undefined);
  const closQuery = useQuery({
    queryKey: ['clos', 'course', courseId],
    queryFn: () => fetchCourseClos(courseId as string),
    enabled: courseId !== undefined,
  });
  const [draft, setDraft] = useState<MappingDraft>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const courses = useMemo(
    () =>
      (coursesQuery.data ?? [])
        .filter((c) => c.curriculumId === curriculumId)
        .sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true })),
    [coursesQuery.data, curriculumId],
  );
  const course = courses.find((c) => c.id === courseId) ?? null;
  const plos = plosOfCurriculum(plosQuery.data ?? [], curriculumId);
  const clos = courseId ? closOfCourse(closQuery.data ?? [], courseId) : [];
  const stored = mappingsQuery.data;
  const cloIds = clos.map((c) => c.id);
  const diff = stored ? diffMappings(stored, draft, cloIds) : null;
  const changes = diff ? diffCount(diff) : 0;
  const entry = overviewQuery.data
    ? findCurriculum(overviewQuery.data.entries, curriculumId)
    : null;
  const outOfScope = overviewQuery.data !== undefined && entry === null;

  // Start the draft from what is stored whenever the course or the stored links change.
  useEffect(() => {
    if (stored) setDraft(draftFromMappings(stored));
  }, [stored, courseId]);

  if (!user) return null;

  // Flow that writes: POST/PATCH/DELETE /clo-plo-mappings, one request per changed link
  async function handleSave() {
    if (!diff || changes === 0) return;
    const ok = await confirm({
      title: 'บันทึกการเชื่อมโยง CLO↔PLO?',
      description: `${diffSummary(diff)} — ${MAPPING_SAVE_NOTE}`,
      confirmLabel: 'บันทึก',
    });
    if (!ok) return;
    setSaving(true);
    setError(null);
    let done = 0;
    try {
      for (const r of diff.removes) {
        await deleteMapping(r.id);
        done += 1;
      }
      for (const u of diff.updates) {
        await updateMapping(u.id, { weight: u.weight });
        done += 1;
      }
      for (const c of diff.creates) {
        await createMapping(c);
        done += 1;
      }
      toast.success('บันทึกการเชื่อมโยงแล้ว');
    } catch (e) {
      const reason = describeMappingError(e);
      setError(done > 0 ? `${reason} (บันทึกสำเร็จแล้ว ${done} จาก ${changes} รายการ)` : reason);
    } finally {
      setSaving(false);
      void queryClient.invalidateQueries({ queryKey: ['clo-plo-mappings'] });
    }
  }

  const courseOptions = courses.map((c) => ({
    value: c.id,
    label: `${c.code} ${c.name}`,
    searchText: `${c.code} ${c.name} ${c.nameEn ?? ''}`,
  }));

  return (
    <DashboardShell role="ADMIN" identityLabel={user.email} fullName={user.fullName}>
      <Link
        href={`/admin/curriculum/${curriculumId}/plos`}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        กลับไปหน้า PLO
      </Link>

      {outOfScope && <PageLoadError message="ไม่พบหลักสูตรนี้ในขอบเขตที่คุณดูแล" />}
      {!outOfScope &&
        (overviewQuery.isLoading || coursesQuery.isLoading || plosQuery.isLoading) && (
          <Skeleton className="h-28 w-full" />
        )}
      {(coursesQuery.isError || plosQuery.isError || mappingsQuery.isError) && (
        <PageLoadError
          message="โหลดข้อมูลไม่สำเร็จ"
          onRetry={() => {
            void coursesQuery.refetch();
            void plosQuery.refetch();
            void mappingsQuery.refetch();
          }}
        />
      )}

      {entry && (
        <PageHeader
          title="เชื่อม CLO↔PLO"
          description={`${entry.programName} · ${entry.programCode} ฉบับ ${entry.version} (พ.ศ. ${entry.effectiveYear})`}
        />
      )}

      {entry && plosQuery.isSuccess && plos.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={ListChecks}
              description="หลักสูตรนี้ยังไม่มี PLO — เพิ่ม PLO ที่หน้า PLO ก่อนจึงจะเชื่อมโยงได้"
            />
          </CardContent>
        </Card>
      )}

      {entry && plos.length > 0 && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Alert className={WARNING_ALERT_CLASS}>
              <AlertDescription>{OUTCOME_EFFECT_WARNING}</AlertDescription>
            </Alert>
            <div className="space-y-1.5">
              <label htmlFor="mapping-course" className="text-sm font-medium">
                เลือกรายวิชา
              </label>
              <StaffCombobox
                id="mapping-course"
                options={courseOptions}
                value={courseId}
                onValueChange={(v) => {
                  setCourseId(v);
                  setError(null);
                }}
                placeholder="เลือกรายวิชา"
                searchPlaceholder="ค้นหารหัสหรือชื่อวิชา"
              />
            </div>

            {course && closQuery.isLoading && <Skeleton className="h-24 w-full" />}
            {course && closQuery.isSuccess && clos.length === 0 && (
              <EmptyState icon={ListChecks} description="รายวิชานี้ยังไม่มี CLO" />
            )}
            {error && <ApiErrorAlert message={error} />}

            {course &&
              clos.map((clo) => (
                <section
                  key={clo.id}
                  aria-labelledby={`clo-${clo.id}`}
                  className="space-y-2 rounded-md border border-slate-200 p-4"
                >
                  <h2 id={`clo-${clo.id}`} className="text-sm font-semibold text-primary">
                    {clo.code}
                  </h2>
                  <p className="break-words text-sm text-muted-foreground">{clo.description}</p>
                  <ul className="divide-y divide-slate-100">
                    {plos.map((plo) => {
                      const key = mappingKey(clo.id, plo.id);
                      const weight = draft[key];
                      const linked = weight !== undefined;
                      return (
                        <li key={plo.id} className="flex flex-wrap items-center gap-3 py-2">
                          <label className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-sm">
                            <input
                              type="checkbox"
                              className="h-5 w-5 shrink-0"
                              checked={linked}
                              onChange={(e) =>
                                setDraft(setLinked(draft, clo.id, plo.id, e.target.checked))
                              }
                            />
                            <span className="min-w-0 break-words">
                              <span className="font-medium">{plo.code}</span> {plo.name}
                            </span>
                          </label>
                          {linked && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">น้ำหนัก</span>
                              <Select
                                value={String(weight)}
                                onValueChange={(v) =>
                                  setDraft(setWeight(draft, clo.id, plo.id, Number(v)))
                                }
                              >
                                <SelectTrigger
                                  className="w-20"
                                  aria-label={`น้ำหนัก ${clo.code} กับ ${plo.code}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {WEIGHT_OPTIONS.map((w) => (
                                    <SelectItem key={w} value={String(w)} className="min-h-11">
                                      {w}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}

            {course && clos.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button onClick={handleSave} disabled={saving || changes === 0}>
                  {saving ? 'กำลังบันทึก...' : 'บันทึกการเชื่อมโยง'}
                </Button>
                <Button
                  variant="outline"
                  disabled={saving || changes === 0}
                  onClick={() => stored && setDraft(draftFromMappings(stored))}
                >
                  ยกเลิกการเปลี่ยนแปลง
                </Button>
                <span className="text-sm text-muted-foreground" aria-live="polite">
                  {diff && changes > 0 ? diffSummary(diff) : 'ยังไม่มีการเปลี่ยนแปลง'}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {dialog}
    </DashboardShell>
  );
}
