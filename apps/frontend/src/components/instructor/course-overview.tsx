'use client';

import { useMemo, type ReactNode } from 'react';
import type { InstructorCourseSummary } from '@eduanalyze-ai/shared-types';
import {
  useInstructorCourseTimeline,
  useInstructorStudents,
  useInstructorYearLevels,
} from '@/lib/instructor-queries';
import { EMPTY_SNAPSHOT, buildCourseSnapshot, courseTermInfo } from '@/lib/course-snapshot';
import { RevealOnScroll } from '@/components/layout/reveal-on-scroll';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { CARD, CARD_PAD } from './instructor-ui';
import { GoalsSection } from './overview/goals-section';
import { GradesSection } from './overview/grades-section';
import { SummarySection } from './overview/summary-section';
import { TrendSection } from './overview/trend-section';
import { YearSection } from './overview/year-section';

// One course, read the same way on the dashboard and on the course page. The
// numbers all come from buildCourseSnapshot, so the two pages cannot differ.
// Which course it is (name, term, actions) is the CourseHero's job. From xl up
// the sections split in two columns: the grade reading on the left (distribution,
// trend, year levels), the course's own context on the right (goals, then `aside`).
export function CourseOverview({
  course,
  aside,
}: Readonly<{ course: InstructorCourseSummary; aside?: ReactNode }>) {
  // Same keys as the other instructor pages: one cached request each.
  const studentsQuery = useInstructorStudents();
  const yearLevelsQuery = useInstructorYearLevels();
  const timelineQuery = useInstructorCourseTimeline();

  const seatRows = useMemo(
    () => (studentsQuery.data?.students ?? []).filter((s) => s.courseId === course.courseId),
    [studentsQuery.data, course.courseId],
  );
  const yearLevelByStudent = useMemo(() => {
    if (!yearLevelsQuery.data || !studentsQuery.data) return null;
    const map = new Map<string, number>();
    for (const bucket of yearLevelsQuery.data.buckets) {
      for (const s of bucket.students) map.set(s.studentProfileId, bucket.yearLevel);
    }
    return map;
  }, [yearLevelsQuery.data, studentsQuery.data]);

  const snapshot = useMemo(
    () => buildCourseSnapshot({ course, seatRows, yearLevelByStudent }),
    [course, seatRows, yearLevelByStudent],
  );
  const termInfo = useMemo(
    () => (timelineQuery.data ? courseTermInfo(timelineQuery.data.years, course.courseId) : null),
    [timelineQuery.data, course.courseId],
  );
  const yearsLoading = studentsQuery.isLoading || yearLevelsQuery.isLoading;
  const yearsFailed = studentsQuery.isError || yearLevelsQuery.isError;

  if (snapshot.empty) {
    return (
      <div className="space-y-6">
        <section className={`${CARD} ${CARD_PAD}`}>
          <p className="text-sm text-muted-foreground">{EMPTY_SNAPSHOT}</p>
        </section>
        {aside && <div className="space-y-6">{aside}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SummarySection snapshot={snapshot} termLabel={termInfo?.termLabel} />
      {yearsFailed && (
        <ApiErrorAlert
          message="โหลดข้อมูลแยกตามชั้นปีไม่สำเร็จ ตัวเลขส่วนอื่นของวิชานี้ยังแสดงได้ตามปกติ"
          onRetry={() => {
            void studentsQuery.refetch();
            void yearLevelsQuery.refetch();
          }}
        />
      )}
      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <RevealOnScroll>
            <GradesSection snapshot={snapshot} />
          </RevealOnScroll>
          <RevealOnScroll>
            <TrendSection snapshot={snapshot} />
          </RevealOnScroll>
          <RevealOnScroll>
            <YearSection snapshot={snapshot} loading={yearsLoading} />
          </RevealOnScroll>
        </div>
        {/* Sticky so the shorter side stays in view while the long side scrolls; the
            max height keeps a tall aside reachable (it scrolls inside) instead of cut off. */}
        <div className="-m-1 min-w-0 space-y-6 p-1 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:self-start xl:overflow-y-auto xl:overscroll-contain">
          <RevealOnScroll>
            <GoalsSection snapshot={snapshot} />
          </RevealOnScroll>
          {aside}
        </div>
      </div>
    </div>
  );
}
