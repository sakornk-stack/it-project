import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { InstructorStudentEntry } from '@eduanalyze-ai/shared-types';
import { gradeBadgeTone } from '@/lib/grade-badge-color';
import { LOW_GRADE_LABEL } from '@/lib/low-grade';
import type { StudentPerson } from '@/lib/student-directory';
import { Reveal } from '@/components/layout/reveal';
import { Skeleton } from '@/components/ui/skeleton';
import { GradeChip } from './grade-chip';
import {
  STUDENT_CARD_MAIN,
  StudentCardFrame,
  StudentCardGrid,
  StudentIdentity,
} from './student-card';

const gradebookHref = (s: InstructorStudentEntry) =>
  `/instructor/courses/${s.courseId}?tab=gradebook&student=${s.studentProfileId}`;

const courseLabel = (e: InstructorStudentEntry) => `${e.courseCode} · ${e.courseName}`;

// One card per person, the same unit the dashboard counts. The whole card opens
// the gradebook of the course that needs attention most; any other courses this
// student takes with you sit behind "ดูอีก N วิชา". The course line shows only
// when the instructor teaches several courses. Only the first few cards arrive
// one after another; the rest are already there.
const STAGGER_LIMIT = 6;

export function StudentPersonList({
  people,
  showCourse = true,
  markLow = true,
  stagger = false,
}: Readonly<{
  people: StudentPerson[];
  // False when the instructor has a single course: it would repeat on every card.
  showCourse?: boolean;
  // False when the page is already filtered to low grades: every card would carry the dot.
  markLow?: boolean;
  stagger?: boolean;
}>) {
  return (
    <StudentCardGrid>
      {people.map((person, index) => {
        const accent = markLow && person.hasLowGrade ? gradeBadgeTone(person.primary.grade) : null;
        return (
          <li key={person.studentProfileId} className="h-full">
            <Reveal index={index} animate={stagger && index < STAGGER_LIMIT} className="h-full">
              <StudentCardFrame accent={accent} accentNote={LOW_GRADE_LABEL}>
                <Link
                  href={gradebookHref(person.primary)}
                  aria-label={
                    accent
                      ? `${person.fullName} ${person.studentCode} ${LOW_GRADE_LABEL}`
                      : undefined
                  }
                  className={STUDENT_CARD_MAIN}
                >
                  <StudentIdentity
                    name={person.fullName}
                    code={person.studentCode}
                    meta={showCourse ? courseLabel(person.primary) : undefined}
                  />
                  <GradeChip grade={person.primary.grade} />
                  <ChevronRight
                    aria-hidden="true"
                    className="go-arrow h-4 w-4 shrink-0 text-muted-foreground"
                  />
                </Link>
                {person.others.length > 0 && (
                  <details className="group border-t">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-b-xl px-5 text-sm text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                      ดูอีก {person.others.length} วิชา
                      <ChevronDown
                        size={16}
                        aria-hidden="true"
                        className="shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                      />
                    </summary>
                    <ul className="divide-y border-t">
                      {person.others.map((entry) => (
                        <li key={entry.courseId}>
                          <Link
                            href={gradebookHref(entry)}
                            className="flex min-h-11 items-center justify-between gap-3 px-5 py-2 text-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span
                              className="min-w-0 truncate text-muted-foreground"
                              title={courseLabel(entry)}
                            >
                              {courseLabel(entry)}
                            </span>
                            <GradeChip grade={entry.grade} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </StudentCardFrame>
            </Reveal>
          </li>
        );
      })}
    </StudentCardGrid>
  );
}

// Same shape as the loaded page: the toolbar row, then person cards.
export function StudentPersonListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 xl:flex-nowrap">
        <Skeleton className="h-11 w-28" />
        <Skeleton className="h-11 w-40" />
        <Skeleton className="h-11 w-full sm:w-72 xl:shrink-0" />
        <Skeleton className="h-11 w-full sm:min-w-64 sm:flex-1" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-card p-5"
          >
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
            <Skeleton className="h-6 w-10 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
