'use client';

import { describeApiError } from '@/lib/describe-api-error';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { SemesterTerm } from '@eduanalyze-ai/shared-types';
import {
  ALL_TERMS,
  bulkGenerateAcademicYears,
  type ResultRow,
  type ResultStatus,
} from '@/lib/bulk-academic-year';
import { SEMESTER_TERM_LABELS } from '@/lib/grade-label';
import {
  bulkAcademicYearSchema,
  MAX_BULK_YEARS,
  type BulkAcademicYearFormValues,
} from '@/lib/validation/academic-year.schema';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/toast-context';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { SemanticTone } from '@/lib/tone';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const STATUS_LABEL: Record<ResultStatus, string> = {
  created: 'สร้างใหม่',
  skipped: 'มีอยู่แล้ว',
};

const STATUS_TONE: Record<ResultStatus, SemanticTone> = {
  created: 'success',
  skipped: 'neutral',
};

export function BulkAcademicYearForm({ onCreated }: { onCreated: () => void }) {
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const toast = useToast();
  const form = useForm<BulkAcademicYearFormValues>({
    resolver: zodResolver(bulkAcademicYearSchema),
    defaultValues: { startYear: undefined, yearCount: 4 },
  });
  const [terms, setTerms] = useState<SemesterTerm[]>(ALL_TERMS);

  function toggleTerm(term: SemesterTerm) {
    setTerms((current) =>
      current.includes(term) ? current.filter((t) => t !== term) : [...current, term],
    );
  }

  async function onSubmit(values: BulkAcademicYearFormValues) {
    setResults(null);
    try {
      const rows = await bulkGenerateAcademicYears(values.startYear, values.yearCount, terms);
      setResults(rows);
      const created = rows.filter((r) => r.status === 'created').length;
      toast.success(
        created > 0
          ? `สร้างปีการศึกษาแล้ว ${created} รายการ`
          : 'ทุกรายการมีอยู่แล้ว ไม่มีอะไรถูกสร้างเพิ่ม',
      );
      onCreated();
    } catch (error) {
      toast.error(
        describeApiError(
          error,
          { 409: 'มีการสร้างรายการเดียวกันพร้อมกัน ไม่มีรายการใดถูกบันทึก กรุณาลองใหม่อีกครั้ง' },
          'สร้างไม่สำเร็จ ไม่มีรายการใดถูกบันทึก กรุณาลองใหม่อีกครั้ง',
        ),
      );
    }
  }

  const createdCount = results?.filter((r) => r.status === 'created').length ?? 0;
  const skippedCount = results?.filter((r) => r.status === 'skipped').length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>สร้างชุดปีการศึกษาอัตโนมัติ</CardTitle>
        <p className="text-sm text-muted-foreground">
          กรอกปีเริ่มต้นและจำนวนปี ระบบจะสร้างปีการศึกษาต่อเนื่องกันพร้อมภาคเรียนที่เลือก
          ปีหรือภาคเรียนที่มีอยู่แล้วจะไม่ถูกสร้างซ้ำ (แสดงเป็น &quot;มีอยู่แล้ว&quot;)
          ระบบสร้างทั้งชุดในครั้งเดียว หากขัดข้องจะไม่มีรายการใดถูกบันทึก และกดสร้างซ้ำได้
        </p>
        <p className="text-sm text-amber-700">
          ระบบถือปีการศึกษาล่าสุดเป็นปีปัจจุบัน —
          การสร้างปีที่ใหม่กว่าปัจจุบันจะทำให้ชั้นปีของนิสิตในแดชบอร์ดเลื่อนตามทันที
        </p>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-3">
              <FormField
                control={form.control}
                name="startYear"
                render={({ field }) => (
                  <FormItem className="w-40">
                    <FormLabel>ปีเริ่มต้น (พ.ศ.)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="2566" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="yearCount"
                render={({ field }) => (
                  <FormItem className="w-28">
                    <FormLabel>จำนวนปี</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={MAX_BULK_YEARS} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'กำลังสร้าง...' : 'สร้างชุดปีการศึกษา'}
              </Button>
            </div>

            <fieldset className="flex flex-wrap items-center gap-4">
              <legend className="mb-1 text-sm font-medium text-primary">
                ภาคเรียนที่จะสร้างในแต่ละปี
              </legend>
              {ALL_TERMS.map((term) => (
                <label key={term} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={terms.includes(term)}
                    onChange={() => toggleTerm(term)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {SEMESTER_TERM_LABELS[term]}
                </label>
              ))}
            </fieldset>

            {results && (
              <div className="space-y-2 rounded-md border border-slate-200 p-3">
                <p className="text-sm font-medium text-primary">
                  สร้างใหม่ {createdCount} รายการ · มีอยู่แล้ว {skippedCount} รายการ
                </p>
                <ul className="space-y-1 text-sm">
                  {results.map((r) => (
                    <li key={r.label} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">{r.label}</span>
                      <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </form>
      </Form>
    </Card>
  );
}
