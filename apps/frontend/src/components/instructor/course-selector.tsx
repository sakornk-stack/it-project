'use client';

import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

export interface CourseChoice {
  courseId: string;
  code: string;
  name: string;
  // Term and curriculum, only what the data has; both may be empty.
  meta: string;
}

// Switch to another course. The one on show is already named in the hero, so it
// is not listed again. A menu on phones (one tap, one hand, full names wrap onto
// more lines), a row of buttons from sm up. State stays with the caller (the
// dashboard keeps it in ?course=). With `hrefFor` the choices are plain links
// instead (the course page: the URL carries the course and the ?tab=).
export function CourseSelector({
  courses,
  activeCourseId,
  onSelect,
  hrefFor,
}: Readonly<{
  courses: CourseChoice[];
  activeCourseId: string;
  onSelect?: (courseId: string) => void;
  hrefFor?: (courseId: string) => string;
}>) {
  const choice = (course: CourseChoice, className: string, children: React.ReactNode) =>
    hrefFor ? (
      <Link key={course.courseId} href={hrefFor(course.courseId)} className={className}>
        {children}
      </Link>
    ) : (
      <button
        key={course.courseId}
        type="button"
        onClick={() => onSelect?.(course.courseId)}
        className={className}
      >
        {children}
      </button>
    );

  const others = courses.filter((c) => c.courseId !== activeCourseId);
  if (others.length === 0) return null;

  return (
    <>
      <details
        key={activeCourseId}
        className="group rounded-lg border border-slate-200 bg-card sm:hidden"
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <span className="text-sm font-medium text-primary">สลับไปวิชาอื่น ({others.length})</span>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {others.map((course) => {
            return (
              <li key={course.courseId}>
                {choice(
                  course,
                  'flex min-h-11 w-full flex-col items-start px-4 py-2 text-left text-sm text-muted-foreground transition hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  <>
                    <span className="break-words">
                      {course.code} {course.name}
                    </span>
                    {course.meta && (
                      <span className="text-xs text-muted-foreground">{course.meta}</span>
                    )}
                  </>,
                )}
              </li>
            );
          })}
        </ul>
      </details>

      <div
        role="group"
        aria-label="สลับไปวิชาอื่น"
        className="hidden flex-wrap items-center gap-2 sm:flex"
      >
        <span className="text-[13px] text-muted-foreground">สลับไปวิชา</span>
        {others.map((course) => {
          return choice(
            course,
            'flex min-h-11 max-w-full flex-col items-start rounded-xl border border-slate-200 px-4 py-2 text-left text-sm text-muted-foreground transition hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            <>
              <span className="break-words">
                {course.code} {course.name}
              </span>
              {course.meta && (
                <span className="text-xs font-normal text-muted-foreground">{course.meta}</span>
              )}
            </>,
          );
        })}
      </div>
    </>
  );
}
