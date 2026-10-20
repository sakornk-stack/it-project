'use client';

import { X } from 'lucide-react';
import { useStudentTimeline } from '@/lib/instructor-queries';
import { gradeBadgeTone } from '@/lib/grade-badge-color';
import { GRADE_LABELS, formatSemesterLabel } from '@/lib/grade-label';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListSkeleton } from '@/components/ui/skeleton';

export function StudentTimelineCard({
  courseId,
  studentProfileId,
  onClose,
}: {
  courseId: string;
  studentProfileId: string;
  onClose: () => void;
}) {
  const query = useStudentTimeline(courseId, studentProfileId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>
            {query.data ? `${query.data.studentCode} ${query.data.fullName}` : 'ผลการเรียน'}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            แสดงเฉพาะวิชาที่คุณสอนนิสิตคนนี้ ไม่ใช่ transcript ฉบับเต็ม
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label="ปิดรายละเอียดนิสิต" onClick={onClose}>
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </CardHeader>
      <CardContent>
        {query.isLoading && <ListSkeleton items={3} />}
        {query.isError && (
          <ApiErrorAlert
            message="ไม่สามารถโหลดผลการเรียนของนิสิตได้ กรุณาลองใหม่อีกครั้ง"
            onRetry={() => void query.refetch()}
          />
        )}
        {query.data && query.data.entries.length === 0 && (
          <p className="text-sm text-muted-foreground">ไม่พบวิชาที่คุณสอนนิสิตคนนี้</p>
        )}
        {query.data && query.data.entries.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
            {query.data.entries.map((entry) => (
              <li
                key={entry.courseId}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="text-muted-foreground">{entry.code}</span>{' '}
                  <span className="text-primary">{entry.name}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatSemesterLabel(entry.semesterTerm, entry.academicYear)}
                  </span>
                  <Badge tone={gradeBadgeTone(entry.grade)}>{GRADE_LABELS[entry.grade]}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
