import Link from 'next/link';
import type {
  InstructorCourseTimelineCourse,
  InstructorCourseTimelineSemester,
} from '@eduanalyze-ai/shared-types';
import { dataLevelOf, SPARSE_LABEL } from '@/lib/course-snapshot';
import { formatSemesterLabel } from '@/lib/grade-label';
import { yearLevelLabel } from '@/lib/course-timeline-summary';
import { Badge } from '@/components/ui/badge';
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
// cut; the curriculum is a quieter second line.
function CourseCard({
  course,
  termText,
}: Readonly<{ course: InstructorCourseTimelineCourse; termText: string }>) {
  return (
    <Link
      href={`/instructor/courses/${course.courseId}`}
      className={`${CARD} ${CARD_PAD} flex h-full min-h-11 flex-col gap-3 transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
    >
      <div className="space-y-1">
        <p className={TEXT_LABEL}>{course.code}</p>
        <p className="break-words text-base font-semibold text-primary">{course.name}</p>
        <p className={TEXT_LABEL}>
          หลักสูตร {course.programCode} ปี {course.curriculumYear}
        </p>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
        <span>{termText}</span>
        <span className="tabular-nums">{course.studentCount} นิสิต</span>
        <SampleTag gradedCount={course.gradedCount} />
        <span className="rounded-full bg-brand-light px-2 py-0.5 text-[13px] text-brand">
          ส่วนใหญ่ {yearLevelLabel(course.predominantYearLevel)}
        </span>
      </div>
    </Link>
  );
}

// One term's courses as a grid of cards: 1 / 2 / 3 columns.
export function TermCourseList({
  semester,
  academicYear,
}: Readonly<{ semester: InstructorCourseTimelineSemester; academicYear: number }>) {
  const termText = formatSemesterLabel(semester.semesterTerm, academicYear);
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {semester.courses.map((course) => (
        <li key={course.courseId}>
          <CourseCard course={course} termText={termText} />
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
