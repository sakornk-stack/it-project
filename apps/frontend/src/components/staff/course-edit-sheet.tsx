'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import type {
  CourseCategory,
  CourseListItem,
  CurriculumRequirement,
  Prerequisite,
} from '@eduanalyze-ai/shared-types';
import { createCourse, deleteCourse, updateCourse } from '@/lib/api/staff';
import { describeApiError } from '@/lib/describe-api-error';
import { OWN_SENTENCE_ONLY, STAFF_WRITE_ERRORS } from '@/lib/api-error-presets';
import { useConfirm } from '@/lib/use-confirm';
import { useToast } from '@/lib/toast-context';
import { ApiErrorAlert, WARNING_ALERT_CLASS } from '@/components/ui/api-error-alert';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  COURSE_DELETE_WARNING,
  courseDeleteTitle,
  courseEditSchema,
  courseToFormValues,
  describeCourseDeleteError,
  toCreateBody,
  toUpdateBody,
  type CourseEditValues,
} from './course-edit';
import { categoryMoveImpact, categoryMoveMessages } from './category-move';
import { PrerequisiteEditor } from './prerequisite-editor';
import { StaffSheet } from './staff-sheet';

export type CourseSheetTarget =
  { kind: 'create'; defaultCategoryId: string | null } | { kind: 'edit'; course: CourseListItem };

const EMPTY: CourseEditValues = {
  code: '',
  name: '',
  nameEn: '',
  credits: undefined as unknown as number,
  description: '',
  isRequired: true,
  categoryId: '',
};

// Add a course, or edit the seven fields PATCH /courses/:id accepts. The
// curriculum is shown and never changed. An existing course can also be removed
// (DELETE /courses/:id) from the foot of the sheet, after a confirmation.
export function CourseEditSheet({
  target,
  onClose,
  curriculumId,
  curriculumLabel,
  categories,
  coursesInCurriculum,
  requirements,
  prerequisites,
  onChanged,
}: Readonly<{
  target: CourseSheetTarget | null;
  onClose: () => void;
  curriculumId: string;
  curriculumLabel: string;
  categories: CourseCategory[];
  coursesInCurriculum: CourseListItem[];
  requirements: CurriculumRequirement[];
  prerequisites: Prerequisite[];
  onChanged: () => void;
}>) {
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const form = useForm<CourseEditValues>({
    resolver: zodResolver(courseEditSchema),
    defaultValues: EMPTY,
  });
  const editing = target?.kind === 'edit' ? target.course : null;
  const watchedCategoryId = form.watch('categoryId');
  const watchedCredits = Number(form.watch('credits'));
  const move = editing
    ? categoryMoveImpact(
        editing,
        { categoryId: watchedCategoryId, credits: watchedCredits },
        coursesInCurriculum,
        categories,
        requirements,
      )
    : null;
  const moveMessages = move ? categoryMoveMessages(move) : null;

  useEffect(() => {
    if (!target) return;
    setServerError(null);
    setDeleteError(null);
    form.reset(
      target.kind === 'edit'
        ? courseToFormValues(target.course)
        : { ...EMPTY, categoryId: target.defaultCategoryId ?? categories[0]?.id ?? '' },
    );
    // Reset only when a different target is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // Flow that writes: POST /courses (add) or PATCH /courses/:id (edit)
  async function onSubmit(values: CourseEditValues) {
    setServerError(null);
    try {
      if (editing) {
        await updateCourse(editing.id, toUpdateBody(values));
        toast.success('บันทึกรายวิชาแล้ว');
      } else {
        await createCourse(toCreateBody(curriculumId, values));
        toast.success('เพิ่มรายวิชาแล้ว');
      }
      onChanged();
      onClose();
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409) {
        setServerError('มีรหัสวิชานี้อยู่ในหลักสูตรนี้แล้ว');
      } else if (isAxiosError(error) && error.response?.status === 400) {
        setServerError('ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบหมวดวิชาและข้อมูลที่กรอก');
      } else {
        setServerError(describeApiError(error, STAFF_WRITE_ERRORS, undefined, OWN_SENTENCE_ONLY));
      }
    }
  }

  // Flow that writes: DELETE /courses/:id. The sheet stays open on any error so
  // the server's reason (e.g. grades still attached) is read where it happened.
  async function handleDelete() {
    if (!editing) return;
    const confirmed = await confirm({
      title: courseDeleteTitle(editing),
      description: COURSE_DELETE_WARNING,
      confirmLabel: 'ลบรายวิชา',
    });
    if (!confirmed) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCourse(editing.id);
      toast.success('ลบรายวิชาแล้ว');
      onChanged();
      onClose();
    } catch (error) {
      setDeleteError(describeCourseDeleteError(error));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <StaffSheet
      open={target !== null}
      onOpenChange={(open) => !open && onClose()}
      title={editing ? `แก้ไขรายวิชา ${editing.code}` : 'เพิ่มรายวิชาใหม่'}
      description={`หลักสูตร: ${curriculumLabel}`}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>รหัสวิชา</FormLabel>
                <FormControl>
                  <Input placeholder="CPE101" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ชื่อวิชา (ภาษาไทย)</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nameEn"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ชื่อวิชา (ภาษาอังกฤษ) ถ้ามี</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="credits"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>หน่วยกิต</FormLabel>
                  <FormControl>
                    <Input type="number" inputMode="numeric" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isRequired"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ประเภทวิชา</FormLabel>
                  <Select
                    value={field.value === false ? 'false' : 'true'}
                    onValueChange={(v) => field.onChange(v === 'true')}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="true" className="min-h-11">
                        วิชาบังคับ
                      </SelectItem>
                      <SelectItem value="false" className="min-h-11">
                        วิชาเลือก
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>หมวดวิชา</FormLabel>
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="h-auto text-left">
                      <SelectValue placeholder="เลือกหมวดวิชา" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="min-h-11">
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
                {moveMessages && (
                  <div role="status" aria-live="polite" className="space-y-2 pt-1">
                    {moveMessages.warning && (
                      <Alert className={WARNING_ALERT_CLASS}>
                        <AlertDescription>{moveMessages.warning}</AlertDescription>
                      </Alert>
                    )}
                    <p className="text-xs text-muted-foreground">{moveMessages.info}</p>
                  </div>
                )}
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>คำอธิบายรายวิชา (ถ้ามี)</FormLabel>
                <FormControl>
                  <Textarea className="min-h-24" {...field} value={field.value ?? ''} />
                </FormControl>
                {editing && (
                  <p className="text-xs text-muted-foreground">
                    เว้นว่างไว้เพื่อคงคำอธิบายเดิม ระบบจะเปลี่ยนก็ต่อเมื่อพิมพ์ข้อความใหม่
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" className="px-5" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? 'กำลังบันทึก...'
                : editing
                  ? 'บันทึกการแก้ไข'
                  : 'เพิ่มรายวิชา'}
            </Button>
            <Button type="button" variant="outline" className="px-5" onClick={onClose}>
              ยกเลิก
            </Button>
          </div>
        </form>
      </Form>

      {editing && (
        <PrerequisiteEditor
          course={editing}
          coursesInCurriculum={coursesInCurriculum}
          prerequisites={prerequisites}
          onChanged={onChanged}
        />
      )}

      {editing && (
        <section
          aria-labelledby="course-delete-heading"
          className="mt-6 space-y-3 rounded-md border border-destructive/40 p-4"
        >
          <h3 id="course-delete-heading" className="text-sm font-semibold text-destructive">
            ลบรายวิชา
          </h3>
          <p className="text-sm text-muted-foreground">{COURSE_DELETE_WARNING}</p>
          {deleteError && <ApiErrorAlert message={deleteError} />}
          <Button
            type="button"
            variant="danger"
            className="w-full border border-destructive/40 sm:w-auto"
            disabled={deleting || form.formState.isSubmitting}
            onClick={handleDelete}
          >
            {deleting ? 'กำลังลบ...' : 'ลบรายวิชา'}
          </Button>
        </section>
      )}
      {confirmDialog}
    </StaffSheet>
  );
}
