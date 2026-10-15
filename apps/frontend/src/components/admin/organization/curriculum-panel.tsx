'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { CurriculumListItem } from '@eduanalyze-ai/shared-types';
import { createCurriculum, deleteCurriculum, updateCurriculum } from '@/lib/api/organization';
import { curriculumSchema, type CurriculumFormValues } from '@/lib/validation/organization.schema';
import { useToast } from '@/lib/toast-context';
import { useConfirm } from '@/lib/use-confirm';
import { describeApiError } from '@/lib/describe-api-error';
import { orgWriteErrors } from '@/lib/api-error-presets';
import { DeactivateButton } from './deactivate-button';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const VERSION_CONFLICT = 'เวอร์ชันหลักสูตรนี้มีอยู่แล้วในสาขานี้';
const TOGGLE_CONFLICT =
  'ไม่สามารถเปลี่ยนสถานะเปิดรับลงทะเบียนได้ อาจมีการเปลี่ยนแปลงจากที่อื่นพร้อมกัน กรุณารีเฟรชหน้านี้';
const OPEN_REGISTRATION_CONFIRM =
  'การเปิดรับลงทะเบียนฉบับนี้จะปิดรับลงทะเบียนฉบับอื่นในสาขานี้โดยอัตโนมัติ ดำเนินการต่อหรือไม่?';

const FIELDS: { name: keyof CurriculumFormValues; label: string; type: 'text' | 'number' }[] = [
  { name: 'version', label: 'เวอร์ชัน', type: 'text' },
  { name: 'effectiveYear', label: 'ปีที่เริ่มใช้', type: 'number' },
  { name: 'totalCredits', label: 'หน่วยกิตรวม', type: 'number' },
  { name: 'maxCreditsPerSemester', label: 'หน่วยกิตสูงสุด/ภาค', type: 'number' },
  { name: 'durationYears', label: 'ระยะเวลาหลักสูตร (ปี)', type: 'number' },
  { name: 'defaultAchievementThreshold', label: 'เกณฑ์ผ่าน CLO (%)', type: 'number' },
];

export function CurriculumPanel({
  programId,
  curricula,
  onChanged,
  readOnly = false,
}: {
  programId: string;
  curricula: CurriculumListItem[];
  onChanged: () => void;
  // Curricula are academic content written by ADMIN; the organisation page (SUPER_ADMIN)
  // only lists them.
  readOnly?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const sorted = [...curricula].sort((a, b) => b.effectiveYear - a.effectiveYear);

  return (
    <div className="space-y-2">
      {sorted.length === 0 && (
        <p className="text-sm text-muted-foreground">ยังไม่มีหลักสูตรในสาขานี้</p>
      )}
      {sorted.map((curriculum) => (
        <CurriculumCard
          key={curriculum.id}
          curriculum={curriculum}
          onChanged={onChanged}
          readOnly={readOnly}
        />
      ))}
      {readOnly ? null : adding ? (
        <CurriculumForm
          submitLabel="เพิ่มหลักสูตร"
          defaultValues={{
            version: '',
            effectiveYear: new Date().getFullYear() + 543,
            totalCredits: 0,
            maxCreditsPerSemester: 22,
            durationYears: 4,
            defaultAchievementThreshold: 70,
          }}
          onSubmit={async (values) => {
            await createCurriculum({ ...values, programId });
            toast.success('เพิ่มหลักสูตรแล้ว');
            setAdding(false);
            onChanged();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
          + เพิ่มหลักสูตร
        </Button>
      )}
    </div>
  );
}

function CurriculumCard({
  curriculum,
  onChanged,
  readOnly,
}: {
  curriculum: CurriculumListItem;
  onChanged: () => void;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  async function toggleRegistration() {
    // Opening this curriculum silently closes any other one in the same
    // program (backend auto-unset) — closing has no such side effect, so
    // only the open direction needs a confirm.
    if (
      !curriculum.isOpenForRegistration &&
      !(await confirm({
        title: 'เปิดรับลงทะเบียนฉบับนี้?',
        description: OPEN_REGISTRATION_CONFIRM,
        confirmLabel: 'เปิดรับลงทะเบียน',
      }))
    ) {
      return;
    }
    setToggling(true);
    setToggleError(null);
    try {
      await updateCurriculum(curriculum.id, {
        isOpenForRegistration: !curriculum.isOpenForRegistration,
      });
      toast.success(
        curriculum.isOpenForRegistration ? 'ปิดรับลงทะเบียนแล้ว' : 'เปิดรับลงทะเบียนแล้ว',
      );
      onChanged();
    } catch (error) {
      // This PATCH never sends `version`, so it can't actually hit the
      // version-conflict path (assertVersionAvailable only runs when
      // dto.version is set) — a distinct message so a future 409 here
      // doesn't show the wrong reason.
      setToggleError(describeApiError(error, orgWriteErrors(TOGGLE_CONFLICT)));
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="rounded-md border border-slate-200 bg-background px-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">หลักสูตร</span>
            <span className="text-sm font-medium text-primary">
              ฉบับ {curriculum.version} (ปี {curriculum.effectiveYear})
            </span>
            <Badge tone={curriculum.isOpenForRegistration ? 'success' : 'neutral'}>
              {curriculum.isOpenForRegistration ? 'เปิดรับลงทะเบียน' : 'ปิดรับลงทะเบียน'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {curriculum.totalCredits} หน่วยกิตรวม · {curriculum.durationYears} ปี · สูงสุด{' '}
            {curriculum.maxCreditsPerSemester} หน่วยกิต/ภาค · เกณฑ์ผ่าน CLO{' '}
            {curriculum.defaultAchievementThreshold}%
          </p>
        </div>
        {!readOnly && (
          <div className="flex items-start gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={toggling}
              onClick={toggleRegistration}
            >
              {curriculum.isOpenForRegistration ? 'ปิดรับลงทะเบียน' : 'ตั้งเป็นฉบับที่เปิดรับ'}
            </Button>
            {!editing && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
                แก้ไข
              </Button>
            )}
            <DeactivateButton
              itemLabel={`หลักสูตรฉบับ ${curriculum.version} (ปี ${curriculum.effectiveYear})`}
              conflictMessage="ปิดใช้งานไม่ได้ เพราะยังมีนิสิต รายวิชา หมวดวิชา หรือ PLO ที่ใช้งานอยู่ในหลักสูตรนี้"
              onConfirm={async () => {
                await deleteCurriculum(curriculum.id);
                toast.success('ปิดใช้งานหลักสูตรแล้ว');
                onChanged();
              }}
            />
          </div>
        )}
      </div>
      {!readOnly && !curriculum.isOpenForRegistration && (
        <p className="mt-1 text-xs text-amber-700">
          การเปิดรับลงทะเบียนจะปิดรับหลักสูตรอื่นในสาขานี้โดยอัตโนมัติ
        </p>
      )}
      {toggleError && <p className="mt-1 text-xs text-destructive">{toggleError}</p>}

      {editing && (
        <div className="mt-2">
          <CurriculumForm
            submitLabel="บันทึก"
            defaultValues={{
              version: curriculum.version,
              effectiveYear: curriculum.effectiveYear,
              totalCredits: curriculum.totalCredits,
              maxCreditsPerSemester: curriculum.maxCreditsPerSemester,
              durationYears: curriculum.durationYears,
              defaultAchievementThreshold: curriculum.defaultAchievementThreshold,
            }}
            onSubmit={async (values) => {
              await updateCurriculum(curriculum.id, values);
              toast.success('บันทึกหลักสูตรแล้ว');
              setEditing(false);
              onChanged();
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}
      {dialog}
    </div>
  );
}

function CurriculumForm({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  defaultValues: CurriculumFormValues;
  submitLabel: string;
  onSubmit: (values: CurriculumFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<CurriculumFormValues>({
    resolver: zodResolver(curriculumSchema),
    defaultValues,
  });

  async function handleSubmit(values: CurriculumFormValues) {
    setServerError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      setServerError(describeApiError(error, orgWriteErrors(VERSION_CONFLICT)));
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3"
      >
        {serverError && <ApiErrorAlert message={serverError} />}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {FIELDS.map((f) => (
            <FormField
              key={f.name}
              control={form.control}
              name={f.name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{f.label}</FormLabel>
                  <FormControl>
                    <Input type={f.type} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'กำลังบันทึก...' : submitLabel}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            ยกเลิก
          </Button>
        </div>
      </form>
    </Form>
  );
}
