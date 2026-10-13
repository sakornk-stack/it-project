'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import type { AssessmentScoreStatus, CloAchievementEntry } from '@eduanalyze-ai/shared-types';
import {
  bulkUpsertStudentAssessmentScores,
  fetchAssessmentCloMappings,
  fetchAssessmentDefinitions,
  fetchStudentAssessmentScores,
} from '@/lib/api/assessment-evidence';
import { fetchCourseRoster } from '@/lib/api/instructor';
import { SCORE_CSV_HEADERS } from '@/lib/assessment-score-import';
import { toCsv, downloadCsv } from '@/lib/csv';
import { shouldReseedScoreForm } from '@/lib/score-form-guard';
import { useConfirm } from '@/lib/use-confirm';
import { effectiveMaxOf, findScoreRowProblems, isCompatibleMax } from '@/lib/score-multi-clo';
import { ASSESSMENT_SCORE_STATUS_LABELS, ASSESSMENT_SCORE_STATUS_OPTIONS } from '@/lib/grade-label';
import { useToast } from '@/lib/toast-context';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EvidenceCoverageBadge } from './evidence-coverage-badge';
import { ScoreCsvImportPanel } from './score-csv-import-panel';
import { StudentActualCloCell } from './student-actual-clo-cell';

interface ScoreRow {
  studentProfileId: string;
  studentCourseRecordId: string;
  studentCode: string;
  fullName: string;
  status: AssessmentScoreStatus;
  // Kept as string in form state (input value), converted to number|undefined on submit.
  score: string;
}

function extractServerMessage(error: unknown): string | null {
  if (!isAxiosError(error)) return null;
  const message = error.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return typeof message === 'string' ? message : null;
}

export function StudentScoreEntryPanel({
  courseId,
  assessmentDefinitionId,
  assessmentCloMappingId,
  clos,
  onDirtyChange,
}: Readonly<{
  courseId: string;
  assessmentDefinitionId: string;
  assessmentCloMappingId: string;
  clos: CloAchievementEntry[];
  onDirtyChange?: (isDirty: boolean) => void;
}>) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // Other CLO mappings of this assessment that the next save should also
  // write to. Deliberately NOT form state: ticking a box must not make the
  // score table "dirty" (H6), and it always starts unticked.
  const [extraMappingIds, setExtraMappingIds] = useState<string[]>([]);

  const rosterQuery = useQuery({
    queryKey: ['course-roster', courseId],
    queryFn: () => fetchCourseRoster(courseId),
  });
  const scoresQuery = useQuery({
    queryKey: ['student-assessment-scores', assessmentCloMappingId],
    queryFn: () => fetchStudentAssessmentScores(assessmentCloMappingId, courseId),
  });
  // Same query keys the definition/mapping panels above already populated, so
  // these resolve from cache — needed only to derive the score ceiling.
  const definitionsQuery = useQuery({
    queryKey: ['assessment-definitions', courseId],
    queryFn: () => fetchAssessmentDefinitions(courseId),
  });
  const mappingsQuery = useQuery({
    queryKey: ['assessment-clo-mappings', assessmentDefinitionId],
    queryFn: () => fetchAssessmentCloMappings(assessmentDefinitionId, courseId),
  });

  const selectedMapping = useMemo(
    () => mappingsQuery.data?.find((m) => m.id === assessmentCloMappingId),
    [mappingsQuery.data, assessmentCloMappingId],
  );

  // Decimal fields arrive as strings; parse only here at the boundary.
  const effectiveMax = useMemo(() => {
    const definition = definitionsQuery.data?.find((d) => d.id === assessmentDefinitionId);
    const raw = selectedMapping?.maxScoreOverride ?? definition?.maxScore;
    return raw === undefined || raw === null ? null : Number(raw);
  }, [selectedMapping, definitionsQuery.data, assessmentDefinitionId]);

  const definitionMaxScore = definitionsQuery.data?.find(
    (d) => d.id === assessmentDefinitionId,
  )?.maxScore;
  const siblingOptions = useMemo(() => {
    if (!mappingsQuery.data || definitionMaxScore === undefined || effectiveMax === null) return [];
    const cloById = new Map(clos.map((c) => [c.cloId, c]));
    return mappingsQuery.data
      .filter((m) => m.id !== assessmentCloMappingId)
      .map((m) => {
        const max = effectiveMaxOf(m, definitionMaxScore);
        return {
          id: m.id,
          label: cloById.get(m.cloId)?.code ?? m.cloId,
          max,
          compatible: isCompatibleMax(max, effectiveMax),
        };
      });
  }, [mappingsQuery.data, definitionMaxScore, effectiveMax, clos, assessmentCloMappingId]);

  // A mapping switch is confirmed by the parent; the selection never carries over.
  useEffect(() => {
    setExtraMappingIds([]);
  }, [assessmentCloMappingId]);

  const form = useForm<{ rows: ScoreRow[] }>({ defaultValues: { rows: [] } });
  const { fields } = useFieldArray({ control: form.control, name: 'rows' });

  const isDirty = form.formState.isDirty;
  const isDirtyRef = useRef(false);
  isDirtyRef.current = isDirty;
  // Set while save/import is refreshing server data, the only times a
  // reseed over dirty edits is intended.
  const forceReseedRef = useRef(false);
  const seededMappingIdRef = useRef<string | null>(null);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  // Seed once both roster and existing scores have loaded. A mapping switch
  // is confirmed by the parent before it reaches here, so the reseed on
  // switch is intentional; a background refetch while dirty is skipped.
  useEffect(() => {
    if (!rosterQuery.data || !scoresQuery.data) return;
    const mappingChanged = seededMappingIdRef.current !== assessmentCloMappingId;
    if (!shouldReseedScoreForm(isDirtyRef.current, forceReseedRef.current || mappingChanged))
      return;
    seededMappingIdRef.current = assessmentCloMappingId;
    const scoreByRecordId = new Map(scoresQuery.data.map((s) => [s.studentCourseRecordId, s]));
    // reset (not replace) so the seeded rows become the clean baseline that
    // dirty tracking compares against.
    form.reset({
      rows: rosterQuery.data.map((student) => {
        const existing = scoreByRecordId.get(student.studentCourseRecordId);
        return {
          studentProfileId: student.studentProfileId,
          studentCourseRecordId: student.studentCourseRecordId,
          studentCode: student.studentCode,
          fullName: student.fullName,
          status: existing?.status ?? 'PENDING',
          score: existing?.score ?? '',
        };
      }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterQuery.data, scoresQuery.data]);

  const gradedCount = useMemo(() => fields.filter((f) => f.status === 'GRADED').length, [fields]);

  // Display only: how many rows differ from what is saved. onSave reads the
  // same dirtyFields to decide what to send.
  const editedCount = (form.formState.dirtyFields.rows ?? []).filter(Boolean).length;

  async function onSave() {
    setServerError(null);
    const rows = form.getValues('rows');
    const dirtyIndexes = form.formState.dirtyFields.rows ?? [];
    const dirtyRows = rows.filter((_, index) => dirtyIndexes[index]);
    const targetIds = [assessmentCloMappingId, ...extraMappingIds];

    const problems = findScoreRowProblems(dirtyRows, effectiveMax);
    if (problems.length > 0) {
      setServerError(`ยังไม่ได้บันทึก — กรุณาแก้ไข: ${problems.join('; ')}`);
      return;
    }

    setSaving(true);
    forceReseedRef.current = true;
    try {
      if (extraMappingIds.length > 0 && !(await confirmOverwrite(dirtyRows, extraMappingIds))) {
        return;
      }
      await bulkUpsertStudentAssessmentScores({
        courseId,
        assessmentDefinitionId,
        assessmentCloMappingIds: targetIds,
        entries: dirtyRows.map((row) => ({
          studentCourseRecordId: row.studentCourseRecordId,
          status: row.status,
          score: row.status === 'GRADED' ? Number(row.score) : undefined,
        })),
      });
      await Promise.all([
        ...targetIds.map((id) =>
          queryClient.invalidateQueries({ queryKey: ['student-assessment-scores', id] }),
        ),
        queryClient.invalidateQueries({ queryKey: ['actual-clo-achievement', courseId] }),
      ]);
      form.reset(form.getValues());
      setExtraMappingIds([]);
      toast.success(
        targetIds.length > 1
          ? `บันทึกคะแนน ${dirtyRows.length} รายการลงเป้าการเรียนรู้ ${targetIds.length} ข้อสำเร็จ`
          : `บันทึกคะแนน ${dirtyRows.length} รายการสำเร็จ`,
      );
    } catch (error) {
      // The batch is all-or-nothing: the form stays dirty and nothing was saved.
      const serverMessage = extractServerMessage(error);
      if (serverMessage) {
        setServerError(`ไม่มีรายการใดถูกบันทึก — ${serverMessage}`);
      } else {
        // No response: the outcome is unknown, so show what the server holds.
        // Re-saving is safe (the endpoint is an idempotent upsert).
        await Promise.all(
          targetIds.map((id) =>
            queryClient.invalidateQueries({ queryKey: ['student-assessment-scores', id] }),
          ),
        ).catch(() => undefined);
        setServerError(
          'บันทึกไม่สำเร็จหรือไม่ทราบผลลัพธ์ (การเชื่อมต่อขัดข้อง) — กรุณาตรวจสอบคะแนนในระบบ แล้วกดบันทึกอีกครั้งได้อย่างปลอดภัย',
        );
      }
    } finally {
      forceReseedRef.current = false;
      setSaving(false);
    }
  }

  // Writing to other CLOs replaces whatever is already recorded there for
  // these students, so say how many existing values will change first.
  const { confirm, dialog } = useConfirm();

  async function confirmOverwrite(dirtyRows: ScoreRow[], mappingIds: string[]): Promise<boolean> {
    const existing = await Promise.all(
      mappingIds.map((id) => fetchStudentAssessmentScores(id, courseId)),
    );
    const changed = new Set<string>();
    existing.forEach((scores) => {
      const byRecord = new Map(scores.map((s) => [s.studentCourseRecordId, s]));
      for (const row of dirtyRows) {
        const prior = byRecord.get(row.studentCourseRecordId);
        if (!prior || prior.status === 'PENDING') continue;
        const sameScore =
          row.status === 'GRADED'
            ? prior.score !== null && Number(prior.score) === Number(row.score)
            : prior.score === null;
        if (prior.status !== row.status || !sameScore) changed.add(row.studentCourseRecordId);
      }
    });
    const labels = siblingOptions
      .filter((o) => mappingIds.includes(o.id))
      .map((o) => o.label)
      .join(', ');
    const overwriteNote =
      changed.size > 0
        ? ` คะแนนเดิมของนิสิต ${changed.size} คนในเป้าเหล่านั้นจะถูกเขียนทับ`
        : ' ไม่มีคะแนนเดิมที่ต่างกันถูกเขียนทับ';
    return confirm({
      title: 'บันทึกคะแนนลงหลายเป้าพร้อมกัน?',
      description: `จะบันทึกคะแนน ${dirtyRows.length} คน ลงในเป้าที่เลือกอยู่ และ ${labels} พร้อมกัน (ทั้งหมดหรือไม่มีเลย).${overwriteNote} ต้องการดำเนินการต่อหรือไม่?`,
      confirmLabel: 'บันทึกคะแนน',
    });
  }

  // Exports what's on screen now, so the file round-trips straight back
  // through import after editing in a spreadsheet.
  function onDownloadTemplate() {
    try {
      const csv = toCsv(
        SCORE_CSV_HEADERS,
        form
          .getValues('rows')
          .map((row) => [
            row.studentCode,
            row.fullName,
            row.status === 'GRADED' ? row.score : '',
            ASSESSMENT_SCORE_STATUS_LABELS[row.status],
          ]),
      );
      downloadCsv(`assessment-scores-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      toast.success('ดาวน์โหลดเทมเพลตแล้ว');
    } catch {
      toast.error('ดาวน์โหลดเทมเพลตไม่สำเร็จ');
    }
  }

  async function onImported() {
    forceReseedRef.current = true;
    try {
      await queryClient.invalidateQueries({
        queryKey: ['student-assessment-scores', assessmentCloMappingId],
      });
    } finally {
      forceReseedRef.current = false;
    }
  }

  const isLoading = rosterQuery.isLoading || scoresQuery.isLoading;
  const isError = rosterQuery.isError || scoresQuery.isError;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-primary">คะแนนของนิสิตแต่ละคน</h3>
        {fields.length > 0 && (
          <EvidenceCoverageBadge
            coverage={{ validCount: gradedCount, totalCount: fields.length }}
          />
        )}
      </div>
      <div className="space-y-4">
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        {fields.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onDownloadTemplate}>
              ดาวน์โหลดเทมเพลต
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setImportOpen((open) => !open)}
              disabled={effectiveMax === null}
            >
              นำเข้า CSV
            </Button>
            {effectiveMax !== null && (
              <span className="text-xs text-muted-foreground">คะแนนเต็ม {effectiveMax}</span>
            )}
          </div>
        )}

        {fields.length > 0 && siblingOptions.length > 0 && (
          <fieldset className="rounded-md border border-slate-200 p-3">
            <legend className="px-1 text-xs font-medium text-muted-foreground">
              บันทึกคะแนนชุดนี้ให้เป้าการเรียนรู้ข้ออื่นของการประเมินนี้ด้วย (ไม่บังคับ)
            </legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {siblingOptions.map((option) => (
                <label
                  key={option.id}
                  className={`flex min-h-11 items-center gap-2 text-sm ${option.compatible ? '' : 'opacity-50'}`}
                  title={
                    option.compatible
                      ? undefined
                      : 'คะแนนเต็มของเป้านี้ไม่เท่ากับเป้าที่เลือกอยู่ จึงใช้คะแนนเดียวกันไม่ได้'
                  }
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    disabled={!option.compatible || saving}
                    checked={extraMappingIds.includes(option.id)}
                    onChange={(e) =>
                      setExtraMappingIds((prev) =>
                        e.target.checked
                          ? [...prev, option.id]
                          : prev.filter((id) => id !== option.id),
                      )
                    }
                  />
                  {option.label}
                  <span className="text-xs text-muted-foreground">(เต็ม {option.max})</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {importOpen && effectiveMax !== null && rosterQuery.data && (
          <ScoreCsvImportPanel
            courseId={courseId}
            assessmentCloMappingId={assessmentCloMappingId}
            roster={rosterQuery.data}
            effectiveMax={effectiveMax}
            onImported={onImported}
            onClose={() => setImportOpen(false)}
          />
        )}

        {isLoading && <TableSkeleton cols={5} rows={4} />}
        {isError && <p className="text-sm text-destructive">ไม่สามารถโหลดข้อมูลได้</p>}
        {!isLoading && !isError && fields.length === 0 && (
          <p className="text-sm text-muted-foreground">ยังไม่มีนิสิตลงทะเบียนในรายวิชานี้</p>
        )}

        {fields.length > 0 && (
          <ul className="space-y-2">
            {fields.map((field, index) => {
              const status = form.watch(`rows.${index}.status`);
              return (
                <li key={field.id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1 basis-48 self-center">
                      <p className="text-primary">{field.fullName}</p>
                      <p className="text-xs text-muted-foreground">{field.studentCode}</p>
                    </div>
                    <div className="grid w-full grid-cols-1 gap-3 min-[400px]:grid-cols-[minmax(8.5rem,1fr)_5.25rem] sm:w-80">
                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        สถานะ
                        <select
                          className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm text-primary"
                          {...form.register(`rows.${index}.status`, {
                            onChange: (e) => {
                              if (e.target.value !== 'GRADED') {
                                form.setValue(`rows.${index}.score`, '', {
                                  shouldDirty: true,
                                });
                              }
                            },
                          })}
                        >
                          {ASSESSMENT_SCORE_STATUS_OPTIONS.map((value) => (
                            <option key={value} value={value}>
                              {ASSESSMENT_SCORE_STATUS_LABELS[value]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        คะแนน
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          inputMode="decimal"
                          disabled={status !== 'GRADED'}
                          className="h-11 w-full rounded-md border border-input bg-background px-2 text-sm text-primary disabled:cursor-not-allowed disabled:opacity-50"
                          {...form.register(`rows.${index}.score`)}
                        />
                      </label>
                    </div>
                  </div>
                  {selectedMapping && (
                    <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-1 text-xs text-muted-foreground [&_button]:min-h-11">
                      ผลของเป้านี้จากคะแนนที่กรอก
                      <StudentActualCloCell
                        courseId={courseId}
                        cloId={selectedMapping.cloId}
                        studentCourseRecordId={field.studentCourseRecordId}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {fields.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={onSave} disabled={saving}>
              {saving ? 'กำลังบันทึก...' : 'บันทึกคะแนนทั้งหมด'}
            </Button>
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {editedCount > 0 ? `แก้ไขแล้ว ${editedCount} คน ยังไม่ได้บันทึก` : 'ยังไม่มีการแก้ไข'}
            </span>
          </div>
        )}
      </div>
      {dialog}
    </div>
  );
}
