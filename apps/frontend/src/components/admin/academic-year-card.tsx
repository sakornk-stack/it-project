'use client';

import { useEffect, useState } from 'react';
import { BookOpen, ChevronRight, GraduationCap, Sun } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import type { AcademicYear, Semester } from '@eduanalyze-ai/shared-types';
import {
  createSemester,
  deleteAcademicYear,
  deleteSemester,
  updateAcademicYear,
  updateSemester,
} from '@/lib/api/admin';
import {
  academicYearSchema,
  type AcademicYearFormValues,
} from '@/lib/validation/academic-year.schema';
import { semesterSchema, type SemesterFormValues } from '@/lib/validation/semester.schema';
import { SEMESTER_TERM_LABELS } from '@/lib/grade-label';
import { cn } from '@/lib/utils';
import { BAR_TONE_CLASSES } from '@/lib/tone';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/toast-context';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { describeApiError } from '@/lib/describe-api-error';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { UserRowMenu } from '@/components/admin/user-row-menu';
import { DeactivateConfirm } from '@/components/admin/deactivate-confirm';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TERM_ORDER: Record<Semester['term'], number> = { FIRST: 0, SECOND: 1, SUMMER: 2 };

// Derived from the term itself: the two main terms are regular, the summer one is special.
const MAX_TERMS_PER_YEAR = Object.keys(SEMESTER_TERM_LABELS).length;

const TERM_KIND: Record<Semester['term'], string> = {
  FIRST: 'ภาคการศึกษาปกติ',
  SECOND: 'ภาคการศึกษาปกติ',
  SUMMER: 'ภาคการศึกษาพิเศษ',
};

export function AcademicYearCard({
  academicYear,
  semesters,
  isLatest = false,
  defaultOpen = true,
  onChanged,
}: {
  academicYear: AcademicYear;
  semesters: Semester[];
  isLatest?: boolean;
  defaultOpen?: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [confirmingYearDelete, setConfirmingYearDelete] = useState(false);
  const toast = useToast();
  const [confirmingSemesterId, setConfirmingSemesterId] = useState<string | null>(null);
  const [editingYear, setEditingYear] = useState(false);
  const [editingSemesterId, setEditingSemesterId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // An error belongs to this card, so show the card it came from.
  useEffect(() => {
    if (serverError) setOpen(true);
  }, [serverError]);

  function toggleOpen() {
    if (open) setServerError(null);
    setOpen(!open);
  }

  const sortedSemesters = [...semesters].sort((a, b) => TERM_ORDER[a.term] - TERM_ORDER[b.term]);
  const confirmingSemester = semesters.find((s) => s.id === confirmingSemesterId);
  const usedTerms = new Set(semesters.map((s) => s.term));
  const availableTerms = (Object.keys(SEMESTER_TERM_LABELS) as Semester['term'][]).filter(
    (term) => !usedTerms.has(term),
  );

  const form = useForm<SemesterFormValues>({
    resolver: zodResolver(semesterSchema),
    defaultValues: { term: undefined },
  });

  const yearEditForm = useForm<AcademicYearFormValues>({
    resolver: zodResolver(academicYearSchema),
    defaultValues: { year: academicYear.year },
  });

  const semesterEditForm = useForm<SemesterFormValues>({
    resolver: zodResolver(semesterSchema),
    defaultValues: { term: undefined },
  });

  async function handleDeleteYear() {
    setBusyId(academicYear.id);
    setServerError(null);
    try {
      await deleteAcademicYear(academicYear.id);
      toast.success('ปิดใช้งานปีการศึกษาแล้ว');
      onChanged();
    } catch (error) {
      setServerError(
        describeApiError(error, {
          409: 'ปิดใช้งานไม่ได้ เพราะยังมีภาคเรียนที่ใช้งานอยู่ในปีการศึกษานี้',
        }),
      );
    } finally {
      setBusyId(null);
      setConfirmingYearDelete(false);
    }
  }

  async function handleDeleteSemester(id: string) {
    setBusyId(id);
    setServerError(null);
    try {
      await deleteSemester(id);
      toast.success('ปิดใช้งานภาคเรียนแล้ว');
      onChanged();
    } catch (error) {
      setServerError(
        describeApiError(error, {
          409: 'ปิดใช้งานไม่ได้ เพราะยังมีการบันทึกผลการเรียนอ้างอิงภาคเรียนนี้อยู่',
        }),
      );
    } finally {
      setBusyId(null);
      setConfirmingSemesterId(null);
    }
  }

  async function onSubmitSemester(values: SemesterFormValues) {
    setServerError(null);
    try {
      await createSemester({ ...values, academicYearId: academicYear.id });
      toast.success('เพิ่มภาคเรียนแล้ว');
      form.reset({ term: undefined });
      onChanged();
    } catch (error) {
      setServerError(describeApiError(error));
    }
  }

  // Adds every term the year is missing, one at a time (the server's
  // duplicate check isn't transactional). A 409 means someone else added it
  // meanwhile and is not a failure.
  async function fillMissingSemesters() {
    setBusyId(academicYear.id);
    setServerError(null);
    let failed = 0;
    for (const term of availableTerms) {
      try {
        await createSemester({ term, academicYearId: academicYear.id });
      } catch (error) {
        if (!(isAxiosError(error) && error.response?.status === 409)) failed += 1;
      }
    }
    setBusyId(null);
    if (failed > 0) setServerError(`สร้างภาคเรียนไม่สำเร็จ ${failed} ภาค กรุณาลองใหม่อีกครั้ง`);
    else toast.success('เพิ่มภาคเรียนที่ขาดครบแล้ว');
    onChanged();
  }

  function startEditingYear() {
    yearEditForm.reset({ year: academicYear.year });
    setEditingYear(true);
  }

  async function onSubmitYearEdit(values: AcademicYearFormValues) {
    setServerError(null);
    try {
      await updateAcademicYear(academicYear.id, values);
      toast.success('บันทึกปีการศึกษาแล้ว');
      setEditingYear(false);
      onChanged();
    } catch (error) {
      setServerError(describeApiError(error, { 409: 'มีปีการศึกษานี้อยู่ในระบบแล้ว' }));
    }
  }

  function startEditingSemester(semester: Semester) {
    semesterEditForm.reset({ term: semester.term });
    setEditingSemesterId(semester.id);
  }

  async function onSubmitSemesterEdit(id: string, values: SemesterFormValues) {
    setServerError(null);
    try {
      await updateSemester(id, values);
      toast.success('บันทึกภาคเรียนแล้ว');
      setEditingSemesterId(null);
      onChanged();
    } catch (error) {
      setServerError(describeApiError(error, { 409: 'ภาคเรียนนี้มีอยู่ในปีการศึกษานี้แล้ว' }));
    }
  }

  const presentTerms = new Set(semesters.map((s) => s.term));
  const termOrder = (Object.keys(TERM_ORDER) as Semester['term'][]).sort(
    (x, y) => TERM_ORDER[x] - TERM_ORDER[y],
  );

  return (
    <div
      id={`academic-year-card-${academicYear.id}`}
      className="rounded-xl border border-slate-200 bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.04)]"
    >
      {/* The whole row folds the card; the controls inside stop the click so they do not. */}
      <div
        onClick={editingYear ? undefined : toggleOpen}
        className={cn(
          'flex items-center gap-2 rounded-xl px-4 py-3 sm:px-5',
          !editingYear && 'interactive-row cursor-pointer',
        )}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            toggleOpen();
          }}
          aria-expanded={open}
          aria-controls={`academic-year-${academicYear.id}`}
          aria-label={`${open ? 'ซ่อน' : 'แสดง'}ภาคเรียนของปีการศึกษา ${academicYear.year}`}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
        >
          <ChevronRight
            size={18}
            aria-hidden="true"
            className={cn(
              'shrink-0 text-slate-500 transition-transform duration-300 ease-out motion-reduce:transition-none',
              open && 'rotate-90',
            )}
          />
          <span
            aria-hidden="true"
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm',
              isLatest
                ? 'from-brand to-brand/70 text-brand-foreground'
                : 'from-brand-light to-brand/15 text-brand',
            )}
          >
            <GraduationCap size={22} />
          </span>
          <span className="min-w-0 space-y-1">
            <span className="block text-xs font-medium tracking-wide text-muted-foreground">
              ปีการศึกษา
            </span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-2xl font-bold leading-none tabular-nums text-primary">
                {academicYear.year}
              </span>
              {isLatest && (
                <Badge tone="neutral" className="border-brand/30 bg-brand-light text-brand">
                  ปีล่าสุด
                </Badge>
              )}
            </span>
            {/* What the year holds, from its active semesters; shown folded or open. */}
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {semesters.length} จาก {MAX_TERMS_PER_YEAR} ภาคเรียนใช้งาน
              </span>
              {/* Only what is missing gets a chip; a full year is just the count. */}
              {termOrder
                .filter((term) => !presentTerms.has(term))
                .map((term) => (
                  <Badge key={term} tone="neutral">
                    {SEMESTER_TERM_LABELS[term]} · ยังไม่มี
                  </Badge>
                ))}
            </span>
          </span>
        </button>
        <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
          <UserRowMenu
            userName={`ปีการศึกษา ${academicYear.year}`}
            items={[
              { key: 'edit', label: 'แก้ไข', onSelect: startEditingYear },
              {
                key: 'deactivate',
                label: 'ปิดใช้งานปีการศึกษา',
                destructive: true,
                onSelect: () => setConfirmingYearDelete(true),
              },
            ]}
          />
        </div>
      </div>

      {editingYear && (
        <div className="px-4 pb-4 sm:px-5">
          <Form {...yearEditForm}>
            <form
              onSubmit={yearEditForm.handleSubmit(onSubmitYearEdit)}
              className="flex flex-wrap items-end gap-2"
            >
              <FormField
                control={yearEditForm.control}
                name="year"
                render={({ field }) => (
                  <FormItem className="w-32">
                    <FormControl>
                      <Input type="number" aria-label="ปีการศึกษา" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" size="sm" disabled={yearEditForm.formState.isSubmitting}>
                บันทึก
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingYear(false)}
              >
                ยกเลิก
              </Button>
            </form>
          </Form>
        </div>
      )}

      {/* Always mounted so the height can ease; `invisible` keeps a folded body out of the tab order. */}
      <div
        id={`academic-year-${academicYear.id}`}
        className={cn(
          'grid transition-[grid-template-rows,visibility] duration-300 ease-out motion-reduce:transition-none',
          open ? 'visible grid-rows-[1fr]' : 'invisible grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-4 border-t border-slate-100 px-4 pb-4 pt-4 sm:px-5">
            {serverError && (
              <ApiErrorAlert message={serverError} onDismiss={() => setServerError(null)} />
            )}

            {sortedSemesters.length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มีภาคเรียนในปีนี้</p>
            ) : (
              <ul>
                {sortedSemesters.map((semester, semesterIndex) => {
                  const editableTerms = [
                    semester.term,
                    ...availableTerms.filter((term) => term !== semester.term),
                  ].sort((a, b) => TERM_ORDER[a] - TERM_ORDER[b]);
                  const TermIcon = semester.term === 'SUMMER' ? Sun : BookOpen;
                  const termLabel = SEMESTER_TERM_LABELS[semester.term];
                  const isLast = semesterIndex === sortedSemesters.length - 1;

                  return (
                    <li
                      key={semester.id}
                      style={{ transitionDelay: open ? `${100 + semesterIndex * 70}ms` : '0ms' }}
                      className={cn(
                        'relative flex items-start gap-3 py-2 transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none',
                        open ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0',
                      )}
                    >
                      {/* The timeline line: one segment per row, from this dot to the next, drawn downward. */}
                      {!isLast && (
                        <span
                          aria-hidden="true"
                          style={{
                            transitionDelay: open ? `${150 + semesterIndex * 70}ms` : '0ms',
                          }}
                          className={cn(
                            'absolute left-[1.1rem] top-[1.875rem] h-full w-px origin-top bg-slate-300 transition-transform duration-300 ease-out motion-reduce:transition-none',
                            open ? 'scale-y-100' : 'scale-y-0',
                          )}
                        />
                      )}
                      <span
                        aria-hidden="true"
                        className="relative z-10 flex h-11 w-9 shrink-0 items-center justify-center"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-light text-sm font-semibold tabular-nums text-brand ring-4 ring-card">
                          {TERM_ORDER[semester.term] + 1}
                        </span>
                      </span>
                      {editingSemesterId === semester.id ? (
                        <Form {...semesterEditForm}>
                          <form
                            onSubmit={semesterEditForm.handleSubmit((values) =>
                              onSubmitSemesterEdit(semester.id, values),
                            )}
                            className="flex min-w-0 flex-1 flex-wrap items-end gap-2"
                          >
                            <FormField
                              control={semesterEditForm.control}
                              name="term"
                              render={({ field }) => (
                                <FormItem className="w-40">
                                  <Select
                                    onValueChange={field.onChange}
                                    value={field.value || undefined}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {editableTerms.map((term) => (
                                        <SelectItem key={term} value={term} className="min-h-11">
                                          {SEMESTER_TERM_LABELS[term]}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button
                              type="submit"
                              size="sm"
                              disabled={semesterEditForm.formState.isSubmitting}
                            >
                              บันทึก
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingSemesterId(null)}
                            >
                              ยกเลิก
                            </Button>
                          </form>
                        </Form>
                      ) : (
                        <>
                          <div className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
                            <p className="flex items-center gap-1.5 break-words text-sm font-semibold text-primary">
                              <TermIcon
                                size={14}
                                aria-hidden="true"
                                className="shrink-0 text-muted-foreground"
                              />
                              {termLabel}
                            </p>
                            <p className="break-words text-xs text-muted-foreground">
                              {TERM_KIND[semester.term]}
                            </p>
                          </div>
                          <span className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
                              <span
                                className={cn(
                                  'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:animate-none',
                                  BAR_TONE_CLASSES.success,
                                )}
                              />
                              <span
                                className={cn(
                                  'relative inline-flex h-1.5 w-1.5 rounded-full',
                                  BAR_TONE_CLASSES.success,
                                )}
                              />
                            </span>
                            ใช้งาน
                          </span>
                          <UserRowMenu
                            userName={`${termLabel} ปีการศึกษา ${academicYear.year}`}
                            triggerLabel={`เมนูเพิ่มเติมของ${termLabel} ปีการศึกษา ${academicYear.year}`}
                            items={[
                              {
                                key: 'edit',
                                label: 'แก้ไข',
                                onSelect: () => startEditingSemester(semester),
                              },
                              {
                                key: 'deactivate',
                                label: 'ปิดใช้งานภาคเรียน',
                                destructive: true,
                                onSelect: () => setConfirmingSemesterId(semester.id),
                              },
                            ]}
                          />
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {availableTerms.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busyId === academicYear.id}
                onClick={fillMissingSemesters}
              >
                เพิ่มภาคเรียนที่ขาดทั้งหมด ({availableTerms.length} ภาค)
              </Button>
            )}

            {availableTerms.length > 0 && (
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmitSemester)}
                  className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4"
                >
                  <FormField
                    control={form.control}
                    name="term"
                    render={({ field }) => (
                      <FormItem className="w-40">
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="เพิ่มภาคเรียน" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableTerms.map((term) => (
                              <SelectItem key={term} value={term} className="min-h-11">
                                {SEMESTER_TERM_LABELS[term]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={form.formState.isSubmitting}
                  >
                    เพิ่มภาคเรียน
                  </Button>
                </form>
              </Form>
            )}
          </div>
        </div>
      </div>
      <DeactivateConfirm
        open={confirmingYearDelete}
        onOpenChange={setConfirmingYearDelete}
        itemLabel={`ปีการศึกษา ${academicYear.year}`}
        busy={busyId === academicYear.id}
        onConfirm={handleDeleteYear}
      />
      <DeactivateConfirm
        open={confirmingSemesterId !== null}
        onOpenChange={(open) => !open && setConfirmingSemesterId(null)}
        itemLabel={`${confirmingSemester ? SEMESTER_TERM_LABELS[confirmingSemester.term] : 'ภาคเรียน'} ปีการศึกษา ${academicYear.year}`}
        busy={busyId !== null && busyId === confirmingSemesterId}
        onConfirm={() => confirmingSemesterId && handleDeleteSemester(confirmingSemesterId)}
      />
    </div>
  );
}

// Same shape as the year card: header with icon tile, year figure and menu, then (when
// `rows` > 0) the timeline of dots and semester rows.
export function AcademicYearCardSkeleton({ rows = 0 }: Readonly<{ rows?: number }>) {
  return (
    <div className="rounded-xl border border-slate-200 bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.04)]">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <Skeleton className="h-[18px] w-[18px] shrink-0 rounded-sm" />
        <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-3 w-40 max-w-full" />
        </div>
        <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
      </div>
      {rows > 0 && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-4 sm:px-5">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-36 max-w-full" />
              </div>
              <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
