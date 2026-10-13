'use client';

import { X } from 'lucide-react';
import { useQueries, useQuery } from '@tanstack/react-query';
import type { CloAchievementEntry } from '@eduanalyze-ai/shared-types';
import { fetchStudentTimeline } from '@/lib/api/instructor';
import { fetchActualCloAchievement } from '@/lib/api/assessment-evidence';
import { formatPercent } from '@/lib/format-percent';
import { gradeBadgeTone } from '@/lib/grade-badge-color';
import { GRADE_LABELS, formatSemesterLabel } from '@/lib/grade-label';
import { AchievementSourceBadge } from './achievement-source-badge';
import { EvidenceCoverageBadge } from './evidence-coverage-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListSkeleton, Skeleton } from '@/components/ui/skeleton';

export function StudentTimelineCard({
  courseId,
  courseCode,
  studentProfileId,
  studentCourseRecordId,
  clos,
  onClose,
}: {
  courseId: string;
  courseCode: string;
  studentProfileId: string;
  // The course attempt this card was opened from — evidence-based CLO
  // results are scoped to one attempt, unlike the grade timeline below
  // which spans every course this instructor teaches the student.
  studentCourseRecordId: string;
  clos: CloAchievementEntry[];
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: ['student-timeline', courseId, studentProfileId],
    queryFn: () => fetchStudentTimeline(courseId, studentProfileId),
  });

  // One request per CLO of this course, fired only while this card is
  // mounted (i.e. only for the one student currently selected in the
  // roster) — never fanned out across the whole class.
  const cloAchievementQueries = useQueries({
    queries: clos.map((clo) => ({
      queryKey: ['actual-clo-achievement', courseId, studentCourseRecordId, clo.cloId],
      queryFn: () => fetchActualCloAchievement(courseId, studentCourseRecordId, clo.cloId),
    })),
  });

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
          <p className="text-sm text-destructive">ไม่สามารถโหลดข้อมูลได้</p>
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

        {clos.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
            <p className="text-sm font-medium text-primary">
              ผลเป้าการเรียนรู้จากคะแนนที่กรอกจริง ({courseCode})
            </p>
            <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
              {clos.map((clo, i) => {
                const cloQuery = cloAchievementQueries[i];
                return (
                  <li
                    key={clo.cloId}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 text-muted-foreground">{clo.code}</span>
                    {cloQuery.isLoading && <Skeleton className="h-5 w-24" />}
                    {cloQuery.isError && (
                      <span className="text-xs text-destructive">โหลดไม่สำเร็จ</span>
                    )}
                    {cloQuery.data && (
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium tabular-nums text-primary">
                          {formatPercent(
                            cloQuery.data.score === null
                              ? null
                              : Number.parseFloat(cloQuery.data.score),
                          )}
                        </span>
                        <AchievementSourceBadge source={cloQuery.data.source} />
                        <EvidenceCoverageBadge coverage={cloQuery.data.coverage} />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
