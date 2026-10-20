'use client';

import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import type { CourseCategory, CourseListItem } from '@eduanalyze-ai/shared-types';
import { fetchInactiveCourses, reactivateCourse } from '@/lib/api/staff';
import { useConfirm } from '@/lib/use-confirm';
import { useToast } from '@/lib/toast-context';
import { cn } from '@/lib/utils';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  describeReactivateError,
  inactiveCoursesSummary,
  reactivateTitle,
  REACTIVATE_NOTE,
} from './inactive-courses';

// Deactivated courses of the selected curriculum, folded by default, each with
// a confirmed "reactivate" (POST /courses/:id/reactivate). The list is only
// fetched once the section is opened. Its query key starts with 'courses', so
// the page's refetch of 'courses' refreshes it too.
export function InactiveCoursesSection({
  curriculumId,
  categories,
  onChanged,
}: Readonly<{
  curriculumId: string;
  categories: CourseCategory[];
  onChanged: () => void;
}>) {
  const bodyId = useId();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['courses', 'inactive', curriculumId],
    queryFn: () => fetchInactiveCourses(curriculumId),
    enabled: open,
  });
  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? 'หมวดที่ปิดใช้งาน';

  // Flow that writes: POST /courses/:id/reactivate
  async function handleReactivate(course: CourseListItem) {
    const confirmed = await confirm({
      title: reactivateTitle(course),
      description: REACTIVATE_NOTE,
      confirmLabel: 'เปิดใช้งาน',
    });
    if (!confirmed) return;
    setBusyId(course.id);
    setError(null);
    try {
      await reactivateCourse(course.id);
      toast.success(`เปิดใช้งานรายวิชา ${course.code} แล้ว`);
      onChanged();
    } catch (e) {
      setError(describeReactivateError(e));
    } finally {
      setBusyId(null);
    }
  }

  const courses = query.data ?? [];

  return (
    <Card>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
      >
        <span className="text-sm font-semibold">
          {open && query.data ? inactiveCoursesSummary(courses.length) : 'รายวิชาที่ปิดใช้งาน'}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div id={bodyId} className="space-y-3 border-t px-4 pb-4 pt-3 sm:px-5">
          {error && <ApiErrorAlert message={error} />}
          {query.isPending && <Skeleton className="h-16 w-full" />}
          {query.isError && <ApiErrorAlert message={describeReactivateError(query.error)} />}
          {query.data && courses.length === 0 && (
            <p className="text-sm text-muted-foreground" role="status">
              {inactiveCoursesSummary(0)}
            </p>
          )}
          {courses.length > 0 && (
            <ul className="divide-y" aria-label="รายวิชาที่ปิดใช้งาน">
              {courses.map((course) => (
                <li
                  key={course.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">
                      <span className="tabular-nums">{course.code}</span> {course.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {course.credits} หน่วยกิต · {categoryName(course.categoryId)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full px-4 sm:w-auto"
                    disabled={busyId !== null}
                    onClick={() => handleReactivate(course)}
                  >
                    {busyId === course.id ? 'กำลังเปิดใช้งาน...' : 'เปิดใช้งาน'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {dialog}
    </Card>
  );
}
