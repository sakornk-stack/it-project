'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarDays, CircleDashed, GraduationCap } from 'lucide-react';
import type { InstructorCourseSummary } from '@eduanalyze-ai/shared-types';
import { useInstructorCourseTimeline } from '@/lib/instructor-queries';
import {
  DATA_SOURCE_NOTE,
  fewStudentsLabel,
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
  const timelineQuery = useInstructorCourseTimeline();
  const termInfo = timelineQuery.data
    ? courseTermInfo(timelineQuery.data.years, course.courseId)
    : null;

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

  // Phones: stacked, full width, 44px high. From sm up they sit side by side at the right.
  const actions = (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row lg:shrink-0 lg:justify-end">
      <Button asChild className="min-h-11 w-full sm:w-auto">
        <Link href={`${base}?tab=students`}>รายชื่อนิสิต {stats.seats} คน</Link>
      </Button>
    </div>
  );
  const metaLoading = timelineQuery.isLoading;
  const metaPlaceholder = (
    <span role="status" className="inline-flex">
      <span className="sr-only">กำลังโหลดภาคเรียนและหลักสูตร</span>
      <Skeleton className="h-6 w-40 rounded-full" />
    </span>
  );
  // Ordered by how an instructor names a course: its code, then when, then which curriculum.
  const metaChips = (
    <>
      <Badge tone="neutral" className="px-2.5 py-1 font-mono text-[13px]">
        {course.code}
      </Badge>
      {metaLoading && metaPlaceholder}
      {termInfo?.termLabel && (
        <Badge tone="neutral" className="gap-1 px-2.5 py-1 text-[13px]">
          <CalendarDays size={14} aria-hidden="true" />
          {termInfo.termLabel}
        </Badge>
      )}
      {termInfo?.curriculum && (
        <Badge tone="neutral" className="gap-1 px-2.5 py-1 text-[13px]">
          <GraduationCap size={14} aria-hidden="true" />
          {termInfo.curriculum}
        </Badge>
      )}
    </>
  );
  const sparseTag = sparse && (
    <Badge tone="neutral" className="gap-1 px-2.5 py-1 text-[13px]">
      <CircleDashed size={14} aria-hidden="true" />
      {fewStudentsLabel(stats.graded)}
    </Badge>
  );

  return (
    <section aria-label="วิชาที่เลือก" className={`${CARD} ${CARD_PAD} space-y-4 sm:p-6`}>
      {heading === 'h1' ? (
        // The course page's title is the app's one page heading.
        <PageHeader
          title={course.name}
          titleClassName="course-name-break"
          description={
            <span className="mt-2 flex flex-wrap items-center gap-2">
              {metaChips}
              {sparseTag}
            </span>
          }
          actions={actions}
        />
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            {title}
            <div className="flex flex-wrap items-center gap-2">
              {metaChips}
              {sparseTag}
            </div>
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
