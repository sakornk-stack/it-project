import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import type { InstructorStudentEntry } from '@eduanalyze-ai/shared-types';
import { LOW_GRADE_LABEL } from '@/lib/low-grade';
import type { StudentPerson } from '@/lib/student-directory';
import { Reveal } from '@/components/layout/reveal';
import { GradeBadge } from '@/components/staff/grade-badge';
import { Badge } from '@/components/ui/badge';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { Skeleton } from '@/components/ui/skeleton';

const gradebookHref = (s: InstructorStudentEntry) =>
  `/instructor/courses/${s.courseId}?tab=gradebook&student=${s.studentProfileId}`;

function CourseLine({ entry }: Readonly<{ entry: InstructorStudentEntry }>) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className="min-w-0 text-muted-foreground">
        {entry.courseCode} {entry.courseName}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="text-muted-foreground">เกรด</span>
        <GradeBadge grade={entry.grade} />
      </span>
    </span>
  );
}

// One card per person, the same unit the dashboard counts. The card's one main
// action opens the gradebook of the course that needs attention most; any
// other courses this student takes with you sit behind "ดูอีก N วิชา". Cards
// stack at every width, so phones never get a sideways-scrolling table, and
// names and course names wrap instead of being cut with "…".
// Only the first few cards arrive one after another; the rest are already there.
const STAGGER_LIMIT = 6;

export function StudentPersonList({
  people,
  showLowBadge = true,
  stagger = false,
}: Readonly<{
  people: StudentPerson[];
  // False when the page is already filtered to low grades: every card would carry it.
  showLowBadge?: boolean;
  stagger?: boolean;
}>) {
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {people.map((person, index) => (
        <li key={person.studentProfileId}>
          <Reveal index={index} animate={stagger && index < STAGGER_LIMIT}>
            <div className="interactive-card rounded-lg border bg-card text-card-foreground shadow-sm">
              <Link
                href={gradebookHref(person.primary)}
                className="block min-h-11 space-y-2 rounded-lg px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <InitialsAvatar name={person.fullName} />
                    <span className="min-w-0">
                      <span className="block font-medium text-primary">{person.fullName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {person.studentCode}
                      </span>
                    </span>
                  </span>
                  {showLowBadge && person.hasLowGrade && (
                    <Badge tone="warning">{LOW_GRADE_LABEL}</Badge>
                  )}
                </span>
                <CourseLine entry={person.primary} />
              </Link>
              {person.others.length > 0 && (
                <details className="group border-t">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-b-lg px-4 text-sm text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
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
                          className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-4 py-2 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <CourseLine entry={entry} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </Reveal>
        </li>
      ))}
    </ul>
  );
}

// Same shape as the loaded page: the filter bar, then person cards.
export function StudentPersonListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
