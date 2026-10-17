'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import type { CourseListItem } from '@eduanalyze-ai/shared-types';
import { createCourseRecord } from '@/lib/api/academic-record';
import {
  courseRecordSchema,
  type CourseRecordFormValues,
} from '@/lib/validation/course-record.schema';
import { GRADE_LABELS, GRADE_OPTIONS } from '@/lib/grade-label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StaffCombobox } from './staff-combobox';

interface SemesterOption {
  id: string;
  label: string;
}

// Staff-sized copy of components/academic-record/add-record-form.tsx (shared
// with the student's own page, so left as it is). Same fields, same request.
export function StaffAddRecordForm({
  studentProfileId,
  courses,
  semesterOptions,
  onCreated,
  onCancel,
}: Readonly<{
  studentProfileId: string;
  courses: CourseListItem[];
  semesterOptions: SemesterOption[];
  onCreated: (newRecordId: string) => void;
  onCancel: () => void;
}>) {
  const [serverError, setServerError] = useState<string | null>(null);
  // Radix Select keeps its own display state, so a successful submit remounts
  // the form to put the selects back on their placeholders.
  const [formKey, setFormKey] = useState(0);
  const form = useForm<CourseRecordFormValues>({
    resolver: zodResolver(courseRecordSchema),
    defaultValues: { courseId: '', semesterId: '', grade: undefined },
  });

  const courseOptions = courses.map((c) => ({
    value: c.id,
    label: `${c.code} — ${c.name} (${c.credits} หน่วยกิต)`,
    searchText: `${c.code} ${c.name}`,
  }));

  // Flow that writes: POST /student-course-records.
  async function onSubmit(values: CourseRecordFormValues) {
    setServerError(null);
    try {
      const record = await createCourseRecord({ studentProfileId, ...values });
      form.reset({ courseId: '', semesterId: '', grade: undefined });
      setFormKey((key) => key + 1);
      onCreated(record.id);
    } catch (error) {
      setServerError(
        isAxiosError(error) && error.response?.status === 409
          ? 'มีการบันทึกวิชานี้ในภาคเรียนนี้ไว้แล้ว'
          : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>เพิ่มรายวิชา</CardTitle>
      </CardHeader>
      <Form {...form}>
        <form key={formKey} onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <FormField
                control={form.control}
                name="semesterId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ภาคเรียน</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกภาคเรียน" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {semesterOptions.map((s) => (
                          <SelectItem key={s.id} value={s.id} className="min-h-11">
                            {s.label}
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
                name="courseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>วิชา</FormLabel>
                    <FormControl>
                      <StaffCombobox
                        options={courseOptions}
                        value={field.value || undefined}
                        onValueChange={field.onChange}
                        placeholder="เลือกวิชา"
                        searchPlaceholder="ค้นหารหัสวิชาหรือชื่อวิชา..."
                        emptyText="ไม่พบวิชาที่ตรงกับคำค้นหา"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="grade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>เกรด</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="เลือกเกรด" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GRADE_OPTIONS.map((g) => (
                          <SelectItem key={g} value={g} className="min-h-11">
                            {GRADE_LABELS[g]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="px-5" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'กำลังบันทึก...' : 'เพิ่มรายวิชา'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="px-5"
                onClick={onCancel}
                disabled={form.formState.isSubmitting}
              >
                ยกเลิก
              </Button>
            </div>
          </CardContent>
        </form>
      </Form>
    </Card>
  );
}
