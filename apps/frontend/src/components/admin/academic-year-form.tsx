'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { bulkCreateAcademicYears } from '@/lib/api/admin';
import { fetchAcademicYears } from '@/lib/api/academic-record';
import { ALL_TERMS } from '@/lib/bulk-academic-year';
import {
  academicYearSchema,
  type AcademicYearFormValues,
} from '@/lib/validation/academic-year.schema';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/toast-context';
import { Input } from '@/components/ui/input';
import { describeApiError } from '@/lib/describe-api-error';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

export function AcademicYearForm({ onCreated }: { onCreated: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const toast = useToast();
  const [withSemesters, setWithSemesters] = useState(true);
  const form = useForm<AcademicYearFormValues>({
    resolver: zodResolver(academicYearSchema),
    defaultValues: { year: undefined },
  });

  async function onSubmit(values: AcademicYearFormValues) {
    setServerError(null);
    try {
      // Check first so an existing year is never touched (the bulk endpoint
      // would top up its missing terms) — same "already exists" outcome as
      // before. The status check below only covers a concurrent create.
      const existingYears = await fetchAcademicYears();
      if (existingYears.some((y) => y.year === values.year)) {
        setServerError('มีปีการศึกษานี้อยู่ในระบบแล้ว');
        return;
      }
      const result = await bulkCreateAcademicYears({
        startYear: values.year,
        yearCount: 1,
        terms: withSemesters ? ALL_TERMS : [],
      });
      if (result.years[0].status === 'skipped') {
        setServerError('มีปีการศึกษานี้อยู่ในระบบแล้ว');
        return;
      }
      toast.success(withSemesters ? 'เพิ่มปีการศึกษาและภาคเรียนแล้ว' : 'เพิ่มปีการศึกษาแล้ว');
      form.reset({ year: undefined });
      onCreated();
    } catch (error) {
      setServerError(describeApiError(error, { 409: 'มีปีการศึกษานี้อยู่ในระบบแล้ว' }));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>เพิ่มปีการศึกษา</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {serverError && <ApiErrorAlert message={serverError} />}

            <div className="flex items-end gap-3">
              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem className="w-40">
                    <FormLabel>ปีการศึกษา (พ.ศ.)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="2569" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'กำลังบันทึก...' : 'เพิ่ม'}
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={withSemesters}
                onChange={(e) => setWithSemesters(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              สร้างภาคเรียนต้น / ปลาย / ฤดูร้อนให้พร้อมกัน
            </label>
          </CardContent>
        </form>
      </Form>
    </Card>
  );
}
