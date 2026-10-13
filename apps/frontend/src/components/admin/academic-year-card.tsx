'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, GraduationCap } from 'lucide-react';
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
import { describeApiError } from '@/lib/describe-api-error';
import { ApiErrorAlert } from '@/components/admin/api-error-alert';
import { UserRowMenu } from '@/components/admin/user-row-menu';
import { DeactivateConfirm } from '@/components/admin/deactivate-confirm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  return (
    <Card className={cn(isLatest && 'bg-brand-light/30')}>
      <CardHeader
        className={cn(
          'flex-row flex-wrap items-center gap-3 space-y-0',
          !editingYear && 'cursor-pointer',
        )}
        onClick={(event) => {
          // The whole row folds the card; its own buttons and the edit form keep their clicks.
          if (editingYear || (event.target as HTMLElement).closest('button, a, input, form'))
            return;
          toggleOpen();
        }}
      >
        {editingYear ? (
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
                      <Input type="number" {...field} />
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
        ) : (
          <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 md:flex md:flex-wrap md:gap-y-2">
            <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-3 md:flex-none">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand"
              >
                <GraduationCap size={20} />
              </span>
              <CardTitle className="min-w-0 break-words leading-snug">ปีการศึกษา {academicYear.year}</CardTitle>
            </div>
            <Button
              type="button"
              variant="outline"
              className="col-start-2 row-start-1 w-11 p-0 md:order-last"
              aria-expanded={open}
              aria-controls={`academic-year-${academicYear.id}`}
              aria-label={`${open ? 'ซ่อน' : 'แสดง'}ภาคเรียนของปีการศึกษา ${academicYear.year}`}
              onClick={toggleOpen}
            >
              <ChevronDown
                size={18}
                aria-hidden="true"
                className={cn(
                  'transition-transform motion-reduce:transition-none',
                  open && 'rotate-180',
                )}
              />
            </Button>
            <div className="col-span-2 row-start-2 flex flex-wrap items-center gap-2 md:contents">
              <div className="flex flex-wrap items-center gap-2 md:flex-1">
                {isLatest && <Badge tone="neutral">ปีล่าสุด</Badge>}
                <Badge tone="neutral">
                  {semesters.length} จาก {MAX_TERMS_PER_YEAR} ภาคเรียนใช้งาน
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={startEditingYear}>
                  แก้ไข
                </Button>
                <UserRowMenu
                  userName={`ปีการศึกษา ${academicYear.year}`}
                  items={[
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
          </div>
        )}
      </CardHeader>
      {open && (
        <CardContent id={`academic-year-${academicYear.id}`} className="space-y-4">
          {serverError && (
            <ApiErrorAlert message={serverError} onDismiss={() => setServerError(null)} />
          )}

          {sortedSemesters.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีภาคเรียนในปีนี้</p>
          ) : (
            <div>
              <ul className="space-y-2 md:space-y-0 md:divide-y md:divide-slate-100">
                {sortedSemesters.map((semester, semesterIndex) => {
                  const editableTerms = [
                    semester.term,
                    ...availableTerms.filter((term) => term !== semester.term),
                  ].sort((a, b) => TERM_ORDER[a] - TERM_ORDER[b]);

                  return (
                    <li
                      key={semester.id}
                      className={cn(
                        'rounded-md border border-l-4 border-slate-100 border-l-brand/40 bg-slate-50 px-3 py-2 text-sm md:rounded-none md:border-y-0 md:border-r-0 md:bg-transparent md:hover:bg-slate-50',
                        editingSemesterId === semester.id ? 'block' : 'flex items-center gap-3',
                      )}
                    >
                      {editingSemesterId === semester.id ? (
                        <Form {...semesterEditForm}>
                          <form
                            onSubmit={semesterEditForm.handleSubmit((values) =>
                              onSubmitSemesterEdit(semester.id, values),
                            )}
                            className="flex w-full flex-wrap items-end gap-2"
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
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-primary">
                              <span className="mr-1.5 text-xs font-medium text-muted-foreground">
                                ภาคที่ {semesterIndex + 1}
                              </span>
                              {SEMESTER_TERM_LABELS[semester.term]}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {TERM_KIND[semester.term]}
                            </p>
                          </div>
                          <Badge tone="success" className="gap-1.5 px-3 py-1 text-sm">
                            <span
                              aria-hidden="true"
                              className={cn('h-2 w-2 rounded-full', BAR_TONE_CLASSES.success)}
                            />
                            ใช้งาน
                          </Badge>
                          <UserRowMenu
                            userName={`${SEMESTER_TERM_LABELS[semester.term]} ปีการศึกษา ${academicYear.year}`}
                            triggerLabel={`เมนูเพิ่มเติมของ${SEMESTER_TERM_LABELS[semester.term]} ปีการศึกษา ${academicYear.year}`}
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
            </div>
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
                className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3"
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
        </CardContent>
      )}
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
    </Card>
  );
}
