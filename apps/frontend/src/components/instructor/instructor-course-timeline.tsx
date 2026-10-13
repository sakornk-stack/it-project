import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type {
  InstructorCourseTimelineCourse,
  InstructorCourseTimelineSemester,
} from '@eduanalyze-ai/shared-types';
import { dataLevelOf, SPARSE_LABEL } from '@/lib/course-snapshot';
import { formatSemesterLabel } from '@/lib/grade-label';
import { yearLevelLabel } from '@/lib/course-timeline-summary';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CARD, CARD_PAD, TEXT_LABEL } from './instructor-ui';
import { LowSampleTag } from './overview-parts';

// The size of the group in words, never only a colour: grey tags, not warnings.
function SampleTag({ gradedCount }: Readonly<{ gradedCount: number }>) {
  const level = dataLevelOf(gradedCount);
  if (level === 'ok') return null;
  return level === 'insufficient' ? (
    <Badge tone="neutral" className="px-2.5 py-0.5 text-[13px]">
      {SPARSE_LABEL}
    </Badge>
  ) : (
    <LowSampleTag counted={gradedCount} />
  );
}

// The whole card is the link (44px+ tall). Course names wrap rather than being
// cut; the curriculum is a quieter second line. The bar sets the class size
// against the largest class of the term.
function CourseCard({
  course,
  termText,
  largest,
}: Readonly<{ course: InstructorCourseTimelineCourse; termText: string; largest: number }>) {
  return (
    <Link
      href={`/instructor/courses/${course.courseId}`}
      className={`${CARD} ${CARD_PAD} interactive-card flex h-full min-h-11 flex-col gap-3 focus-visible:outline-none`}
    >
      <div className="space-y-1">
        <p className={TEXT_LABEL}>{course.code}</p>
        <p className="break-words text-base font-semibold text-primary">{course.name}</p>
        <p className={TEXT_LABEL}>
          หลักสูตร {course.programCode} ปี {course.curriculumYear}
        </p>
      </div>
      <div className="mt-auto space-y-2">
        <Progress
          value={largest > 0 ? (course.studentCount / largest) * 100 : 0}
          label={`นิสิต ${course.studentCount} คน เทียบกับวิชาที่มีนิสิตมากที่สุดในภาคเรียนนี้`}
          className="h-1.5"
          barClassName="bg-brand"
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <span>{termText}</span>
          <span className="tabular-nums">{course.studentCount} นิสิต</span>
          <SampleTag gradedCount={course.gradedCount} />
          <span className="rounded-full bg-brand-light px-2 py-0.5 text-[13px] text-brand">
            ส่วนใหญ่ {yearLevelLabel(course.predominantYearLevel)}
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
          ดูผลการเรียน
          <ArrowRight aria-hidden="true" className="go-arrow h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

// An older term's course as one line: code and name, size of the class, an
// arrow. The whole line is the link.
function CourseRow({ course }: Readonly<{ course: InstructorCourseTimelineCourse }>) {
  return (
    <Link
      href={`/instructor/courses/${course.courseId}`}
      className="interactive-row flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-sm focus-visible:outline-none"
    >
      <span className="min-w-0">
        <span className="text-muted-foreground">{course.code}</span>{' '}
        <span className="break-words font-medium text-primary">{course.name}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
        <span className="tabular-nums">{course.studentCount} นิสิต</span>
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </span>
    </Link>
  );
}

// One term's courses: a grid of cards (1 / 2 / 3 columns) for the latest term,
// or compact rows (`compact`) for the earlier ones.
export function TermCourseList({
  semester,
  academicYear,
  compact = false,
}: Readonly<{
  semester: InstructorCourseTimelineSemester;
  academicYear: number;
  compact?: boolean;
}>) {
  const termText = formatSemesterLabel(semester.semesterTerm, academicYear);
  if (compact) {
    return (
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
        {semester.courses.map((course) => (
          <li key={course.courseId}>
            <CourseRow course={course} />
          </li>
        ))}
      </ul>
    );
  }
  const largest = Math.max(0, ...semester.courses.map((c) => c.studentCount));
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {semester.courses.map((course) => (
        <li key={course.courseId}>
          <CourseCard course={course} termText={termText} largest={largest} />
        </li>
      ))}
    </ul>
  );
}

export function TermHeading({ term, count }: Readonly<{ term: string; count: number }>) {
  return (
    <h3 className="text-sm font-medium text-muted-foreground">
      {formatSemesterLabel(term, undefined)} · {count} วิชา
    </h3>
  );
}
