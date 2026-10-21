'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { CloDetail, CloPloMappingItem, PloListItem } from '@eduanalyze-ai/shared-types';
import {
  createClo,
  createMapping,
  deleteClo,
  deleteMapping,
  updateClo,
  updateMapping,
} from '@/lib/api/curriculum-outcomes';
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
  CLO_EMPTY,
  cloDeleteTitle,
  cloEditSchema,
  cloToFormValues,
  type CloEditValues,
} from './clo-edit';
import {
  WEIGHT_HELP,
  WEIGHT_OPTIONS,
  draftFromMappings,
  setLinked,
  setWeight,
  type LinkDraft,
} from './mapping-edit';
import { deleteCloWithLinks, describeFailure, saveCloWithLinks, type SaveApi } from './save-clo';

export type CloPanelTarget = { kind: 'create' } | { kind: 'edit'; clo: CloDetail };

const API: SaveApi = {
  createClo,
  updateClo,
  deleteClo,
  createMapping,
  updateMapping,
  deleteMapping,
};

// One panel for everything about a CLO: its text, pass mark, confirmed state, and the PLOs it
// answers with a weight each. Save runs the CLO call and the PLO calls one after another.
export function CloPanel({
  target,
  onClose,
  courseId,
  courseLabel,
  plos,
  mappings,
  onChanged,
}: Readonly<{
  target: CloPanelTarget | null;
  onClose: () => void;
  courseId: string;
  courseLabel: string;
  plos: PloListItem[];
  mappings: CloPloMappingItem[];
  onChanged: () => void;
}>) {
  const toast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [draft, setDraft] = useState<LinkDraft>({});
  // Set when a save created the CLO but a later step failed: a retry then updates it.
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const form = useForm<CloEditValues>({
    resolver: zodResolver(cloEditSchema),
    defaultValues: CLO_EMPTY,
  });
  const editing = target?.kind === 'edit' ? target.clo : null;
  const cloId = editing?.id ?? savedId;
  const stored = cloId ? mappings.filter((m) => m.cloId === cloId) : [];
  const ploCode = (ploId: string) => plos.find((p) => p.id === ploId)?.code ?? 'PLO';

  useEffect(() => {
    if (!target) return;
    setSaveError(null);
    setDeleteError(null);
    setSavedId(null);
    if (target.kind === 'edit') {
      form.reset(cloToFormValues(target.clo));
      setDraft(draftFromMappings(mappings.filter((m) => m.cloId === target.clo.id)));
    } else {
      form.reset(CLO_EMPTY);
      setDraft({});
    }
    // Reset only when a different target is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // Flow that writes: POST/PATCH /clos, then POST/PATCH/DELETE /clo-plo-mappings, in order
  async function onSubmit(values: CloEditValues) {
    setSaveError(null);
    const result = await saveCloWithLinks(API, {
      clo: cloId ? { id: cloId } : null,
      courseId,
      values,
      stored,
      draft,
      ploCode,
    });
    if (result.cloId) setSavedId(result.cloId);
    onChanged();
    const failure = describeFailure(result);
    if (failure) {
      setSaveError(failure);
      return;
    }
    toast.success('บันทึก CLO แล้ว');
    onClose();
  }

  // Flow that writes: DELETE /clo-plo-mappings/:id for each PLO it answers, then DELETE /clos/:id
  async function handleDelete() {
    if (!editing) return;
    const confirmed = await confirm({
      title: cloDeleteTitle(editing),
      description: CLO_DELETE_WARNING,
      confirmLabel: 'ลบ CLO',
    });
    if (!confirmed) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteCloWithLinks(API, {
      clo: editing,
      stored,
      ploCode,
    });
    setDeleting(false);
    onChanged();
    const failure = describeFailure(result);
    if (failure) {
      setDeleteError(failure);
      return;
    }
    toast.success('ลบ CLO แล้ว');
    onClose();
  }

  const busy = form.formState.isSubmitting || deleting;

  return (
    <StaffSheet
      open={target !== null}
      onOpenChange={(open) => !open && onClose()}
      title={editing ? `แก้ไข ${editing.code}` : 'เพิ่ม CLO ใหม่'}
      description={courseLabel}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
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
                <FormLabel>ข้อความ CLO</FormLabel>
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
                  <p className="text-xs text-muted-foreground">เว้นว่างเพื่อใช้เกณฑ์ของหลักสูตร</p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isConfirmed"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>สถานะ</FormLabel>
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

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-primary">PLO ที่ CLO นี้ตอบ</legend>
            <p className="text-xs text-muted-foreground">{WEIGHT_HELP}</p>
            {plos.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                หลักสูตรนี้ยังไม่มี PLO — เพิ่ม PLO ที่แท็บ &quot;PLO ของหลักสูตร&quot; ก่อน
              </p>
            ) : (
              <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
                {plos.map((plo) => {
                  const weight = draft[plo.id];
                  const linked = weight !== undefined;
                  return (
                    <li key={plo.id} className="flex flex-wrap items-center gap-3 px-3 py-1.5">
                      <label className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          className="h-5 w-5 shrink-0"
                          checked={linked}
                          onChange={(e) => setDraft(setLinked(draft, plo.id, e.target.checked))}
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
                            onValueChange={(v) => setDraft(setWeight(draft, plo.id, Number(v)))}
                          >
                            <SelectTrigger className="w-20" aria-label={`น้ำหนักของ ${plo.code}`}>
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
            )}
          </fieldset>

          <FormActions>
            <Button type="submit" className="px-5" disabled={busy}>
              {form.formState.isSubmitting
                ? 'กำลังบันทึก...'
                : editing || savedId
                  ? 'บันทึกการแก้ไข'
                  : 'เพิ่ม CLO'}
            </Button>
            <Button type="button" variant="outline" className="px-5" onClick={onClose}>
              ยกเลิก
            </Button>
          </FormActions>
        </form>
      </Form>

      {editing && (
        <DangerZone id="clo-delete-heading" title="ลบ CLO" description={CLO_DELETE_WARNING}>
          {deleteError && <ApiErrorAlert message={deleteError} />}
          <Button
            type="button"
            variant="danger"
            className="w-full border border-destructive/40 sm:w-auto"
            disabled={busy}
            onClick={handleDelete}
          >
            {deleting ? 'กำลังลบ...' : 'ลบ CLO'}
          </Button>
        </DangerZone>
      )}
      {confirmDialog}
    </StaffSheet>
  );
}
