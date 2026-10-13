'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CircleDashed } from 'lucide-react';
import type { InstructorCourseSummary } from '@eduanalyze-ai/shared-types';
import { fetchInstructorCourseTimeline } from '@/lib/api/instructor';
import {
  DATA_SOURCE_NOTE,
  SPARSE_LABEL,
  courseTermInfo,
  excludedNote,
  gradedPeopleParts,
} from '@/lib/course-snapshot';
import { summarizeGradeCenter } from '@/lib/grade-center';
import { buildCourseOverviews } from '@/lib/instructor-overview';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { CARD, CARD_PAD, TEXT_LABEL, TEXT_PAGE, TEXT_SECTION } from './instructor-ui';

// The one card that says which course this is: code, name, term and curriculum
// on the left, the two things an instructor does next on the right. The "few
// data" tag lives here and nowhere else on the page. `detailHref` makes the
// name a link (the dashboard, where the course page is one step further).
export function CourseHero({
  course,
  heading,
  detailHref,
  switcher,
}: Readonly<{
  course: InstructorCourseSummary;
  heading: 'h1' | 'h2';
  detailHref?: string;
  switcher?: ReactNode;
}>) {
  const timelineQuery = useQuery({
    queryKey: ['instructor-course-timeline'],
    queryFn: fetchInstructorCourseTimeline,
  });
  const termInfo = timelineQuery.data
    ? courseTermInfo(timelineQuery.data.years, course.courseId)
    : null;
  const meta = [termInfo?.termLabel, termInfo?.curriculum].filter(Boolean).join(' · ');

  const { stats } = buildCourseOverviews([course])[0];
  const { people, excluded } = gradedPeopleParts(stats);
  const note = excludedNote(excluded);
  const sparse = people > 0 && summarizeGradeCenter(stats.counts).values === null;

  const base = `/instructor/courses/${course.courseId}`;
  const Heading = heading;
  const title = (
    <Heading className={`break-words ${heading === 'h1' ? TEXT_PAGE : TEXT_SECTION}`}>
      {detailHref ? (
        <Link
          href={detailHref}
          className="group inline-flex min-h-11 items-center gap-2 rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {course.name}
          <ArrowRight
            size={18}
            aria-hidden="true"
            className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </Link>
      ) : (
        course.name
      )}
    </Heading>
  );

  const actions = (
    <div className="flex flex-wrap gap-2 lg:shrink-0 lg:justify-end">
      <Button asChild>
        <Link href={`${base}?tab=evidence`}>กรอกคะแนน</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href={`${base}?tab=students`}>รายชื่อนิสิต ({stats.seats})</Link>
      </Button>
    </div>
  );
  const metaLoading = timelineQuery.isLoading;
  const metaPlaceholder = (
    <span role="status" className="inline-flex">
      <span className="sr-only">กำลังโหลดภาคเรียนและหลักสูตร</span>
      <Skeleton className="h-4 w-40" />
    </span>
  );
  const sparseTag = sparse && (
    <Badge tone="neutral" className="gap-1 px-2.5 py-1 text-[13px]">
      <CircleDashed size={14} aria-hidden="true" />
      {SPARSE_LABEL}
    </Badge>
  );

  return (
    <section aria-label="วิชาที่เลือก" className={`${CARD} ${CARD_PAD} space-y-4`}>
      {heading === 'h1' ? (
        // The course page's title is the app's one page heading.
        <PageHeader
          title={course.name}
          description={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{course.code}</span>
              {metaLoading ? metaPlaceholder : meta && <span>{meta}</span>}
              {sparseTag}
            </span>
          }
          actions={actions}
        />
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1">
            <p className={TEXT_LABEL}>{course.code}</p>
            {title}
            {(meta || sparse || metaLoading) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {metaLoading
                  ? metaPlaceholder
                  : meta && <p className="text-sm text-muted-foreground">{meta}</p>}
                {sparseTag}
              </div>
            )}
          </div>
          {actions}
        </div>
      )}
      {switcher}
      {people > 0 && (
        <p className={`border-t border-slate-100 pt-3 ${TEXT_LABEL}`}>
          {DATA_SOURCE_NOTE} · จากนิสิตที่มีเกรด {people} คน
          {note ? ` (${note})` : ''}
        </p>
      )}
    </section>
  );
}
