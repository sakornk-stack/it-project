'use client';

import { BookOpen } from 'lucide-react';
import type { InstructorCourseSummary } from '@eduanalyze-ai/shared-types';
import { useInstructorCourseCatalog, useInstructorPrerequisites } from '@/lib/instructor-queries';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CollapsibleCard } from './section-card';

// Folded by default: reference data an instructor rarely needs. One card whose
// header is the toggle; the facts and the prerequisites live inside it.
export function CourseInfoSection({ course }: { course: InstructorCourseSummary }) {
  const coursesQuery = useInstructorCourseCatalog();
  const prerequisitesQuery = useInstructorPrerequisites();

  const courseMap = new Map((coursesQuery.data ?? []).map((c) => [c.id, c]));
  const detail = courseMap.get(course.courseId);
  const prerequisites = (prerequisitesQuery.data ?? []).filter(
    (p) => p.courseId === course.courseId,
  );
  const isLoading = coursesQuery.isLoading || prerequisitesQuery.isLoading;
  const isError = coursesQuery.isError || prerequisitesQuery.isError;

  return (
    <CollapsibleCard
      icon={BookOpen}
      title="ข้อมูลรายวิชา"
      description="ชื่อภาษาอังกฤษ หน่วยกิต ประเภท และวิชาที่ต้องผ่านก่อน"
    >
      {isLoading && (
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      )}
      {isError && (
        <ApiErrorAlert
          message="ไม่สามารถโหลดข้อมูลรายวิชาได้ กรุณาลองใหม่อีกครั้ง"
          onRetry={() => {
            if (coursesQuery.isError) void coursesQuery.refetch();
            if (prerequisitesQuery.isError) void prerequisitesQuery.refetch();
          }}
        />
      )}
      {detail && (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-1">
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">ชื่อภาษาอังกฤษ</dt>
            <dd className="break-words text-primary">{detail.nameEn ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">หน่วยกิต</dt>
            <dd className="tabular-nums text-primary">{detail.credits}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">ประเภท</dt>
            <dd>
              <Badge tone={detail.isRequired ? 'success' : 'neutral'}>
                {detail.isRequired ? 'วิชาบังคับ' : 'วิชาเลือก'}
              </Badge>
            </dd>
          </div>
        </dl>
      )}

      <div className="space-y-2 border-t pt-4">
        <h3 className="text-sm font-medium text-primary">วิชาที่ต้องผ่านก่อน (Prerequisite)</h3>
        {!isLoading && !isError && prerequisites.length === 0 && (
          <p className="text-sm text-muted-foreground">รายวิชานี้ไม่มีวิชาที่ต้องผ่านก่อน</p>
        )}
        {prerequisites.length > 0 && (
          <ul className="space-y-1.5 text-sm">
            {prerequisites.map((p) => {
              const prereq = courseMap.get(p.prerequisiteCourseId);
              return (
                <li key={p.id} className="flex items-baseline gap-2 text-primary">
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {prereq?.code ?? '—'}
                  </span>
                  <span className="min-w-0 break-words">{prereq?.name ?? 'ไม่พบข้อมูลวิชา'}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </CollapsibleCard>
  );
}
