import Link from 'next/link';
import { ArrowRight, BookOpen, GraduationCap, Users, UsersRound } from 'lucide-react';
import type {
  InstructorCourseTimelineCourse,
  InstructorCourseTimelineSemester,
} from '@eduanalyze-ai/shared-types';
import { dataLevelOf, SPARSE_LABEL } from '@/lib/course-snapshot';
import { formatSemesterLabel } from '@/lib/grade-label';
import { predominantYearLevel, yearLevelLabel } from '@/lib/course-timeline-summary';
import { BAR_TONE_CLASSES } from '@/lib/tone';
import { StatCard } from '@/components/dashboard/stat-card';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Badge } from '@/components/ui/badge';
import { CARD, TEXT_LABEL } from './instructor-ui';
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

const STRIP_TONE: Record<'ok' | 'low' | 'insufficient', string> = {
  ok: 'bg-brand',
  low: BAR_TONE_CLASSES.neutral,
  insufficient: BAR_TONE_CLASSES.warning,
};

// The whole card is the link (44px+ tall). A thin strip on top carries the data level;
// the two figures are real counts (this term, all terms).
function CourseCard({ course }: Readonly<{ course: InstructorCourseTimelineCourse }>) {
  const level = dataLevelOf(course.gradedCount);
  return (
    <Link
      href={`/instructor/courses/${course.courseId}`}
      className={`${CARD} interactive-card relative flex h-full min-h-11 flex-col overflow-hidden bg-gradient-to-b from-card to-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2`}
    >
      <span aria-hidden="true" className={`h-1 w-full ${STRIP_TONE[level]}`} />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="space-y-2">
          <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
            {course.code}
          </span>
          <p
            title={course.name}
            className="course-name-break line-clamp-2 text-base font-semibold text-primary"
          >
            {course.name}
          </p>
          <p className={TEXT_LABEL}>
            หลักสูตร {course.programCode} ปี {course.curriculumYear}
          </p>
        </div>
        <dl className="grid grid-cols-2 divide-x divide-slate-200 text-center">
          <div className="px-2">
            <dd className="text-2xl font-semibold tabular-nums text-primary">
              {course.studentCount}
              <span className="ml-1 text-sm font-normal text-muted-foreground">คน</span>
            </dd>
            <dt className={TEXT_LABEL}>เทอมนี้</dt>
          </div>
          <div className="px-2">
            <dd className="text-2xl font-semibold tabular-nums text-primary">
              {course.totalStudentCount}
              <span className="ml-1 text-sm font-normal text-muted-foreground">คน</span>
            </dd>
            <dt className={TEXT_LABEL}>ทั้งหมด (ทุกเทอม)</dt>
          </div>
        </dl>
        <div className="flex flex-wrap items-center gap-2">
          <SampleTag gradedCount={course.gradedCount} />
          <span className="whitespace-nowrap rounded-full bg-brand-light px-2.5 py-0.5 text-[13px] text-brand">
            ส่วนใหญ่ {yearLevelLabel(course.predominantYearLevel)}
          </span>
        </div>
        <span className="mt-auto flex items-center justify-end gap-1 border-t border-slate-200 pt-3 text-sm font-semibold text-primary">
          ดูผลการเรียน
          <ArrowRight aria-hidden="true" className="go-arrow h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

// An older term's course as one line: code and name on the left (cut with an ellipsis,
// full text in the title), class size and arrow on the right. The whole line is the link.
function CourseRow({
  course,
  termText,
}: Readonly<{ course: InstructorCourseTimelineCourse; termText: string }>) {
  return (
    <Link
      href={`/instructor/courses/${course.courseId}`}
      title={`${course.code} ${course.name}`}
      className="interactive-row flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
    >
      <span className="min-w-0 flex-1 truncate">
        <span className="text-muted-foreground">{course.code}</span>{' '}
        <span className="font-medium text-primary">{course.name}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2 whitespace-nowrap text-muted-foreground">
        <span className="tabular-nums">
          {termText} · {course.studentCount} คน
        </span>
        <ArrowRight aria-hidden="true" className="go-arrow h-4 w-4" />
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
            <CourseRow course={course} termText={termText} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {semester.courses.map((course) => (
        <li key={course.courseId}>
          <CourseCard course={course} />
        </li>
      ))}
    </ul>
  );
}

export function TermHeading({ term, count }: Readonly<{ term: string; count: number }>) {
  return (
    <h4 className="text-sm font-medium text-muted-foreground">
      {formatSemesterLabel(term, undefined)} · {count} วิชา
    </h4>
  );
}

// Four figures: courses, students this term, students over all terms, year level. Students
// are counted per course, so one in two courses counts twice; the caption says so.
export function TermSummaryStrip({
  courses,
}: Readonly<{ courses: readonly InstructorCourseTimelineCourse[] }>) {
  const sum = (pick: (c: InstructorCourseTimelineCourse) => number) =>
    courses.reduce((total, c) => total + (pick(c) > 0 ? pick(c) : 0), 0);
  const termSeats = sum((c) => c.studentCount);
  const allSeats = sum((c) => c.totalStudentCount);
  const overlap = courses.length > 1 ? 'ถ้าเรียนหลายวิชาจะนับซ้ำ' : undefined;
  const level = predominantYearLevel(courses);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        dense
        interactive={false}
        icon={BookOpen}
        tone="primary"
        label="วิชาที่สอน"
        value={<AnimatedNumber value={courses.length} />}
        suffix="วิชา"
      />
      <StatCard
        dense
        interactive={false}
        icon={Users}
        tone="success"
        label="นิสิตเทอมนี้"
        value={<AnimatedNumber value={termSeats} />}
        suffix="คน"
        caption={overlap}
      />
      <StatCard
        dense
        interactive={false}
        icon={UsersRound}
        tone="warning"
        label="นิสิตทั้งหมด (ทุกเทอม)"
        value={<AnimatedNumber value={allSeats} />}
        suffix="คน"
        caption={overlap}
      />
      <StatCard
        dense
        interactive={false}
        icon={GraduationCap}
        tone="neutral"
        label="ส่วนใหญ่อยู่ชั้น"
        value={level === null ? '—' : yearLevelLabel(level)}
      />
    </div>
  );
}
