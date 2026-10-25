'use client';

import { useId, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { Plus, Trash2 } from 'lucide-react';
import type { CourseListItem, Grade, SemesterTerm } from '@eduanalyze-ai/shared-types';
import { createCourseRecord } from '@/lib/api/academic-record';
import { GRADE_LABELS, GRADE_OPTIONS, SEMESTER_TERM_LABELS } from '@/lib/grade-label';
import { defaultSemesterId, groupSemestersByYear, selectableCourseIds } from '@/lib/batch-record';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';

interface SemesterOption {
  id: string;
  year: number | undefined;
  term: SemesterTerm;
  label: string;
}

interface Row {
  key: number;
  courseId: string | null;
  grade: Grade | null;
  error: string | null;
}

const emptyRow = (key: number): Row => ({ key, courseId: null, grade: null, error: null });

// One semester, many courses, one save: the student picks a year and a term
// once, then adds as many course + grade rows as they took that term.
// Each row is its own POST (the API takes one record at a time); rows that
// fail stay on screen with the reason, rows that succeed leave the form.
export function AddRecordForm({
  studentProfileId,
  courses,
  semesterOptions,
  recorded,
  onCreated,
  onCancel,
  autoFocus = false,
}: Readonly<{
  studentProfileId: string;
  courses: CourseListItem[];
  semesterOptions: SemesterOption[];
  // Active records, to skip courses already saved in the chosen semester and
  // to suggest the term after the latest one.
  recorded: readonly { courseId: string; semesterId: string }[];
  onCreated: (newRecordIds: string[]) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}>) {
  const idPrefix = useId();
  const years = useMemo(() => groupSemestersByYear(semesterOptions), [semesterOptions]);
  const [semesterId, setSemesterId] = useState<string | null>(() =>
    defaultSemesterId(years, new Set(recorded.map((r) => r.semesterId))),
  );
  const selectedYear =
    years.find((y) => y.terms.some((t) => t.semesterId === semesterId))?.year ?? years[0]?.year;
  const yearTerms = years.find((y) => y.year === selectedYear)?.terms ?? [];

  const [rows, setRows] = useState<Row[]>([emptyRow(0)]);
  const [nextKey, setNextKey] = useState(1);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const allCourseIds = useMemo(() => courses.map((c) => c.id), [courses]);
  const recordedInSemester = useMemo(
    () => new Set(recorded.filter((r) => r.semesterId === semesterId).map((r) => r.courseId)),
    [recorded, semesterId],
  );

  const filled = rows.filter((r) => r.courseId && r.grade);
  const totalCredits = filled.reduce(
    (sum, r) => sum + (courseById.get(r.courseId!)?.credits ?? 0),
    0,
  );

  function changeYear(year: string) {
    const terms = years.find((y) => String(y.year) === year)?.terms ?? [];
    // Keep the same term when the new year has it.
    const currentTerm = yearTerms.find((t) => t.semesterId === semesterId)?.term;
    setSemesterId((terms.find((t) => t.term === currentTerm) ?? terms[0])?.semesterId ?? null);
  }

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, error: null } : r)));
  }

  function addRow() {
    setRows((rs) => [...rs, emptyRow(nextKey)]);
    setNextKey((k) => k + 1);
  }

  function removeRow(key: number) {
    setRows((rs) => (rs.length === 1 ? [emptyRow(nextKey)] : rs.filter((r) => r.key !== key)));
    if (rows.length === 1) setNextKey((k) => k + 1);
  }

  async function save() {
    setFormError(null);
    if (!semesterId) {
      setFormError('กรุณาเลือกภาคเรียน');
      return;
    }
    const incomplete = rows.some((r) => (r.courseId && !r.grade) || (!r.courseId && r.grade));
    if (filled.length === 0 || incomplete) {
      setRows((rs) =>
        rs.map((r) =>
          r.courseId && !r.grade
            ? { ...r, error: 'กรุณาเลือกเกรด' }
            : !r.courseId && (r.grade || rs.length === 1)
              ? { ...r, error: 'กรุณาเลือกวิชา' }
              : r,
        ),
      );
      return;
    }

    setSaving(true);
    const createdIds: string[] = [];
    const remaining: Row[] = [];
    for (const row of rows) {
      if (!row.courseId || !row.grade) continue; // blank extra rows are dropped
      try {
        const record = await createCourseRecord({
          studentProfileId,
          courseId: row.courseId,
          semesterId,
          grade: row.grade,
        });
        createdIds.push(record.id);
      } catch (error) {
        remaining.push({
          ...row,
          error:
            isAxiosError(error) && error.response?.status === 409
              ? 'มีการบันทึกวิชานี้ในภาคเรียนนี้ไว้แล้ว'
              : 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
        });
      }
    }
    setSaving(false);
    setRows(remaining.length > 0 ? remaining : [emptyRow(nextKey)]);
    setNextKey((k) => k + 1);
    if (createdIds.length > 0) onCreated(createdIds);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>เพิ่มรายวิชา</CardTitle>
        <p className="text-sm text-muted-foreground">
          เลือกภาคเรียนครั้งเดียว แล้วเพิ่มทุกวิชาที่เรียนในภาคนั้น บันทึกพร้อมกันทีเดียว
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">ภาคเรียน</legend>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select
              value={selectedYear ? String(selectedYear) : undefined}
              onValueChange={changeYear}
            >
              <SelectTrigger autoFocus={autoFocus} aria-label="ปีการศึกษา" className="sm:w-48">
                <SelectValue placeholder="ปีการศึกษา" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y.year} value={String(y.year)}>
                    ปีการศึกษา {y.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div role="radiogroup" aria-label="ภาค" className="grid flex-1 grid-cols-3 gap-2">
              {yearTerms.map((t) => {
                const active = t.semesterId === semesterId;
                return (
                  <button
                    key={t.semesterId}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSemesterId(t.semesterId)}
                    className={cn(
                      'min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                      active
                        ? 'border-brand bg-brand-light text-brand'
                        : 'bg-card text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {SEMESTER_TERM_LABELS[t.term] ?? t.term}
                  </button>
                );
              })}
            </div>
          </div>
        </fieldset>

        <div className="space-y-3">
          <div className="hidden grid-cols-[minmax(0,1fr)_10rem_2.75rem] gap-2 text-sm font-medium md:grid">
            <span>วิชา</span>
            <span>เกรด</span>
            <span className="sr-only">ลบแถว</span>
          </div>
          <ul className="space-y-3">
            {rows.map((row, index) => {
              const ids = selectableCourseIds(
                allCourseIds,
                rows.map((r) => r.courseId),
                index,
                recordedInSemester,
              );
              const options: ComboboxOption[] = ids.map((id) => {
                const c = courseById.get(id)!;
                return {
                  value: c.id,
                  label: `${c.code} — ${c.name} (${c.credits} หน่วยกิต)`,
                  searchText: `${c.code} ${c.name}`,
                };
              });
              const errorId = `${idPrefix}-row-${row.key}-error`;
              return (
                <li
                  key={row.key}
                  className="space-y-1 rounded-lg border bg-muted/30 p-3 md:border-0 md:bg-transparent md:p-0"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_2.75rem] gap-2 md:grid-cols-[minmax(0,1fr)_10rem_2.75rem]">
                    <div className="min-w-0">
                      <Label className="sr-only" htmlFor={`${idPrefix}-course-${row.key}`}>
                        วิชาแถวที่ {index + 1}
                      </Label>
                      <Combobox
                        id={`${idPrefix}-course-${row.key}`}
                        options={options}
                        value={row.courseId ?? undefined}
                        onValueChange={(v) => updateRow(row.key, { courseId: v })}
                        placeholder="เลือกวิชา"
                        searchPlaceholder="ค้นหารหัสวิชาหรือชื่อวิชา..."
                        emptyText="ไม่พบวิชาที่ตรงกับคำค้นหา"
                        aria-describedby={row.error ? errorId : undefined}
                        disabled={saving}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="row-action h-11 w-11 p-0 md:order-last"
                      onClick={() => removeRow(row.key)}
                      disabled={saving}
                      aria-label={`ลบแถวที่ ${index + 1}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </Button>
                    <div className="col-span-2 md:col-span-1">
                      <Select
                        value={row.grade ?? undefined}
                        onValueChange={(v) => updateRow(row.key, { grade: v as Grade })}
                        disabled={saving}
                      >
                        <SelectTrigger aria-label={`เกรดแถวที่ ${index + 1}`}>
                          <SelectValue placeholder="เลือกเกรด" />
                        </SelectTrigger>
                        <SelectContent>
                          {GRADE_OPTIONS.map((g) => (
                            <SelectItem key={g} value={g}>
                              {GRADE_LABELS[g]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {row.error && (
                    <p id={errorId} className="text-sm text-destructive">
                      {row.error}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full gap-1.5 border-dashed sm:w-auto"
            onClick={addRow}
            disabled={saving}
          >
            <Plus size={16} aria-hidden="true" />
            เพิ่มอีกวิชา
          </Button>
        </div>

        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            {filled.length > 0
              ? `พร้อมบันทึก ${filled.length} วิชา รวม ${totalCredits} หน่วยกิต`
              : 'ยังไม่ได้เลือกวิชา'}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" onClick={save} disabled={saving} className="min-h-11">
              {saving
                ? 'กำลังบันทึก...'
                : filled.length > 1
                  ? `บันทึก ${filled.length} วิชา`
                  : 'บันทึก'}
            </Button>
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={onCancel}
                disabled={saving}
              >
                ยกเลิก
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
