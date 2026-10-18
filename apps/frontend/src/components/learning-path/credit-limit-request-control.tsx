'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Settings2, X } from 'lucide-react';
import type { CreditLimitRequest } from '@eduanalyze-ai/shared-types';
import { deleteCreditLimitRequest, upsertCreditLimitRequest } from '@/lib/api/credit-limit-request';
import { CREDIT_LIMIT_PRESETS, CREDIT_LIMIT_SELF_SET_NOTE } from '@/lib/credit-limit-presets';
import {
  creditLimitRequestSchema,
  type CreditLimitRequestFormValues,
} from '@/lib/validation/credit-limit-request.schema';
import { useToast } from '@/lib/toast-context';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Self-declared, no approval workflow — POST takes effect immediately and nobody
// is notified, so the copy says "set"/"save", never "request"/"send".
// Sits in the "จัดแผนเทอมหน้า" section's actions slot, next to the reset
// button. Form is inline (toggled by local state), not a dialog — this
// codebase has no Dialog/Sheet primitive, so every short form here follows
// the same inline-toggle pattern as CurriculumForm in curriculum-panel.tsx.
export function CreditLimitRequestControl({
  request,
  onChanged,
}: Readonly<{
  request: CreditLimitRequest | null;
  onChanged: () => void;
}>) {
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function handleCancel() {
    setCancelling(true);
    setCancelError(null);
    try {
      await deleteCreditLimitRequest();
      onChanged();
      toast.success('ยกเลิกการตั้งช่วงหน่วยกิตแล้ว');
    } catch {
      setCancelError('ยกเลิกการตั้งช่วงหน่วยกิตไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setCancelling(false);
    }
  }

  if (request) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <Badge tone="success">ช่วงที่ตั้งไว้: {CREDIT_LIMIT_PRESETS[request.type].label}</Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            disabled={cancelling}
            onClick={handleCancel}
          >
            <X size={14} aria-hidden="true" />
            {cancelling ? 'กำลังยกเลิก...' : 'ยกเลิกการตั้งค่า'}
          </Button>
        </div>
        {cancelError && <p className="text-xs text-destructive">{cancelError}</p>}
      </div>
    );
  }

  if (showForm) {
    return (
      <CreditLimitRequestForm
        onCancel={() => setShowForm(false)}
        onSubmitted={() => {
          setShowForm(false);
          onChanged();
        }}
      />
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={() => setShowForm(true)}
    >
      <Settings2 size={14} aria-hidden="true" />
      ปรับช่วงหน่วยกิตในแผน
    </Button>
  );
}

function CreditLimitRequestForm({
  onCancel,
  onSubmitted,
}: Readonly<{
  onCancel: () => void;
  onSubmitted: () => void;
}>) {
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<CreditLimitRequestFormValues>({
    resolver: zodResolver(creditLimitRequestSchema),
    defaultValues: { type: 'EXCEED_MAX', reason: '' },
  });

  async function onSubmit(values: CreditLimitRequestFormValues) {
    setServerError(null);
    try {
      await upsertCreditLimitRequest(values);
      onSubmitted();
      toast.success('บันทึกช่วงหน่วยกิตในแผนของคุณแล้ว');
    } catch {
      setServerError('บันทึกช่วงหน่วยกิตไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="w-full space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:w-80"
      >
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
        <p className="text-xs text-muted-foreground">{CREDIT_LIMIT_SELF_SET_NOTE}</p>
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ช่วงหน่วยกิตที่ต้องการ</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(CREDIT_LIMIT_PRESETS).map(([type, preset]) => (
                    <SelectItem key={type} value={type}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>เหตุผล</FormLabel>
              <FormControl>
                <Input placeholder="เช่น ชั้นปีสุดท้าย" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            ยกเลิก
          </Button>
        </div>
      </form>
    </Form>
  );
}
