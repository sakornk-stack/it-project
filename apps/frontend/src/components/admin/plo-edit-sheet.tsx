'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { PloListItem } from '@eduanalyze-ai/shared-types';
import { createPlo, deletePlo, updatePlo } from '@/lib/api/curriculum-outcomes';
import { useConfirm } from '@/lib/use-confirm';
import { useToast } from '@/lib/toast-context';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { FormActions, DangerZone } from '@/components/ui/form-actions';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StaffSheet } from '@/components/staff/staff-sheet';
import {
  PLO_DELETE_WARNING,
  PLO_EMPTY,
  describePloError,
  ploDeleteTitle,
  ploEditSchema,
  ploToFormValues,
  toCreatePloBody,
  toUpdatePloBody,
  type PloEditValues,
} from './plo-edit';

export type PloSheetTarget = { kind: 'create' } | { kind: 'edit'; plo: PloListItem };

// Add a PLO to the curriculum, or edit one (PATCH /plos/:id). An existing PLO can also be
// deleted (DELETE /plos/:id) from the foot of the sheet, after a confirmation.
export function PloEditSheet({
  target,
  onClose,
  curriculumId,
  curriculumLabel,
  onChanged,
}: Readonly<{
  target: PloSheetTarget | null;
  onClose: () => void;
  curriculumId: string;
  curriculumLabel: string;
  onChanged: () => void;
}>) {
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const form = useForm<PloEditValues>({
    resolver: zodResolver(ploEditSchema),
    defaultValues: PLO_EMPTY,
  });
  const editing = target?.kind === 'edit' ? target.plo : null;

  useEffect(() => {
    if (!target) return;
    setServerError(null);
    setDeleteError(null);
    form.reset(target.kind === 'edit' ? ploToFormValues(target.plo) : PLO_EMPTY);
    // Reset only when a different target is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // Flow that writes: POST /plos (add) or PATCH /plos/:id (edit)
  async function onSubmit(values: PloEditValues) {
    setServerError(null);
    try {
      if (editing) {
        await updatePlo(editing.id, toUpdatePloBody(values));
        toast.success('บันทึก PLO แล้ว');
      } else {
        await createPlo(toCreatePloBody(curriculumId, values));
        toast.success('เพิ่ม PLO แล้ว');
      }
      onChanged();
      onClose();
    } catch (error) {
      setServerError(describePloError(error));
    }
  }

  // Flow that writes: DELETE /plos/:id. The sheet stays open on an error so the
  // server's reason (CLO links still attached) is read where it happened.
  async function handleDelete() {
    if (!editing) return;
    const confirmed = await confirm({
      title: ploDeleteTitle(editing),
      description: PLO_DELETE_WARNING,
      confirmLabel: 'ลบ PLO',
    });
    if (!confirmed) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deletePlo(editing.id);
      toast.success('ลบ PLO แล้ว');
      onChanged();
      onClose();
    } catch (error) {
      setDeleteError(describePloError(error));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <StaffSheet
      open={target !== null}
      onOpenChange={(open) => !open && onClose()}
      title={editing ? `แก้ไข ${editing.code}` : 'เพิ่ม PLO ใหม่'}
      description={curriculumLabel}
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
                <FormLabel>รหัส PLO</FormLabel>
                <FormControl>
                  <Input placeholder="PLO1" {...field} />
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
                <FormLabel>ชื่อ PLO</FormLabel>
                <FormControl>
                  <Input {...field} />
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
                <FormLabel>คำอธิบาย (ถ้ามี)</FormLabel>
                <FormControl>
                  <Textarea className="min-h-24" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormActions>
            <Button type="submit" className="px-5" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? 'กำลังบันทึก...'
                : editing
                  ? 'บันทึกการแก้ไข'
                  : 'เพิ่ม PLO'}
            </Button>
            <Button type="button" variant="outline" className="px-5" onClick={onClose}>
              ยกเลิก
            </Button>
          </FormActions>
        </form>
      </Form>

      {editing && (
        <DangerZone id="plo-delete-heading" title="ลบ PLO" description={PLO_DELETE_WARNING}>
          {deleteError && <ApiErrorAlert message={deleteError} />}
          <Button
            type="button"
            variant="danger"
            className="w-full border border-destructive/40 sm:w-auto"
            disabled={deleting || form.formState.isSubmitting}
            onClick={handleDelete}
          >
            {deleting ? 'กำลังลบ...' : 'ลบ PLO'}
          </Button>
        </DangerZone>
      )}
      {confirmDialog}
    </StaffSheet>
  );
}
