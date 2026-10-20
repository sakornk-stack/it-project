'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { CloDetail } from '@eduanalyze-ai/shared-types';
import { createClo, deleteClo, updateClo } from '@/lib/api/curriculum-outcomes';
import { useConfirm } from '@/lib/use-confirm';
import { useToast } from '@/lib/toast-context';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ApiErrorAlert, WARNING_ALERT_CLASS } from '@/components/ui/api-error-alert';
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
import { StaffSheet } from '@/components/staff/staff-sheet';
import {
  CLO_DELETE_WARNING,
  CLO_EFFECT_WARNING,
  CLO_EMPTY,
  cloDeleteTitle,
  cloEditSchema,
  cloToFormValues,
  describeCloError,
  toCreateCloBody,
  toUpdateCloBody,
  type CloEditValues,
} from './clo-edit';

export type CloSheetTarget = { kind: 'create' } | { kind: 'edit'; clo: CloDetail };

// Add a CLO to the selected course, or edit one (PATCH /clos/:id). An existing CLO can
// also be deleted (DELETE /clos/:id) from the foot of the sheet, after a confirmation.
export function CloEditSheet({
  target,
  onClose,
  courseId,
  courseLabel,
  onChanged,
}: Readonly<{
  target: CloSheetTarget | null;
  onClose: () => void;
  courseId: string;
  courseLabel: string;
  onChanged: () => void;
}>) {
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const form = useForm<CloEditValues>({
    resolver: zodResolver(cloEditSchema),
    defaultValues: CLO_EMPTY,
  });
  const editing = target?.kind === 'edit' ? target.clo : null;

  useEffect(() => {
    if (!target) return;
    setServerError(null);
    setDeleteError(null);
    form.reset(target.kind === 'edit' ? cloToFormValues(target.clo) : CLO_EMPTY);
    // Reset only when a different target is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // Flow that writes: POST /clos (add) or PATCH /clos/:id (edit)
  async function onSubmit(values: CloEditValues) {
    setServerError(null);
    try {
      if (editing) {
        await updateClo(editing.id, toUpdateCloBody(values));
        toast.success('บันทึก CLO แล้ว');
      } else {
        await createClo(toCreateCloBody(courseId, values));
        toast.success('เพิ่ม CLO แล้ว');
      }
      onChanged();
      onClose();
    } catch (error) {
      setServerError(describeCloError(error));
    }
  }

  // Flow that writes: DELETE /clos/:id. The sheet stays open on an error so the
  // server's reason (PLO links or scores still attached) is read where it happened.
  async function handleDelete() {
    if (!editing) return;
    const confirmed = await confirm({
      title: cloDeleteTitle(editing),
      description: `${CLO_DELETE_WARNING} ${CLO_EFFECT_WARNING}`,
      confirmLabel: 'ลบ CLO',
    });
    if (!confirmed) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteClo(editing.id);
      toast.success('ลบ CLO แล้ว');
      onChanged();
      onClose();
    } catch (error) {
      setDeleteError(describeCloError(error));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <StaffSheet
      open={target !== null}
      onOpenChange={(open) => !open && onClose()}
      title={editing ? `แก้ไข ${editing.code}` : 'เพิ่ม CLO ใหม่'}
      description={`รายวิชา: ${courseLabel}`}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
          {editing && (
            <Alert className={WARNING_ALERT_CLASS}>
              <AlertDescription>{CLO_EFFECT_WARNING}</AlertDescription>
            </Alert>
          )}

          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>รหัส CLO</FormLabel>
                <FormControl>
                  <Input placeholder="CLO1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>คำอธิบาย</FormLabel>
                <FormControl>
                  <Textarea className="min-h-24" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="achievementThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>เกณฑ์ผ่าน (ร้อยละ 0–100)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="ใช้ค่าของหลักสูตร"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    เว้นว่างเพื่อใช้เกณฑ์ตั้งต้นของหลักสูตร
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isConfirmed"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>สถานะการยืนยัน</FormLabel>
                  <Select
                    value={field.value ? 'true' : 'false'}
                    onValueChange={(v) => field.onChange(v === 'true')}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="true" className="min-h-11">
                        ยืนยันแล้ว
                      </SelectItem>
                      <SelectItem value="false" className="min-h-11">
                        ยังไม่ยืนยัน
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" className="px-5" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? 'กำลังบันทึก...'
                : editing
                  ? 'บันทึกการแก้ไข'
                  : 'เพิ่ม CLO'}
            </Button>
            <Button type="button" variant="outline" className="px-5" onClick={onClose}>
              ยกเลิก
            </Button>
          </div>
        </form>
      </Form>

      {editing && (
        <section
          aria-labelledby="clo-delete-heading"
          className="mt-6 space-y-3 rounded-md border border-destructive/40 p-4"
        >
          <h3 id="clo-delete-heading" className="text-sm font-semibold text-destructive">
            ลบ CLO
          </h3>
          <p className="text-sm text-muted-foreground">{CLO_DELETE_WARNING}</p>
          {deleteError && <ApiErrorAlert message={deleteError} />}
          <Button
            type="button"
            variant="danger"
            className="w-full border border-destructive/40 sm:w-auto"
            disabled={deleting || form.formState.isSubmitting}
            onClick={handleDelete}
          >
            {deleting ? 'กำลังลบ...' : 'ลบ CLO'}
          </Button>
        </section>
      )}
      {confirmDialog}
    </StaffSheet>
  );
}
