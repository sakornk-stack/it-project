import Link from 'next/link';
import { ArrowRight, Users } from 'lucide-react';
import type { AtRiskStudent } from '@eduanalyze-ai/shared-types';
import { formatSemesterLabel } from '@/lib/grade-label';
import { LOW_GRADE_LABEL, LOW_GRADE_RULE, NO_LOW_GRADE, isLowGrade } from '@/lib/low-grade';
import { Badge } from '@/components/ui/badge';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { GradeChip } from './grade-chip';
import { SectionCard } from './section-card';

// Keeps the overview short; the students tab lists everyone.
const MAX_VISIBLE = 5;

// Who in THIS course has a low grade. Reads course.atRiskStudents (the latest
// attempt of each student) and keeps the D+, D, F and U ones; a C is left out.
// Each row opens that student in the students tab.
export function CourseFollowUpList({
  courseId,
  students,
}: Readonly<{ courseId: string; students: AtRiskStudent[] }>) {
  // The backend lists them worst grade first already.
  const sorted = students.filter((s) => isLowGrade(s.grade));
  const visible = sorted.slice(0, MAX_VISIBLE);
  const hidden = sorted.length - visible.length;

  return (
    <SectionCard
      icon={Users}
      title={
        <span className="flex flex-wrap items-center gap-2">
          นิสิตที่{LOW_GRADE_LABEL}
          {sorted.length > 0 && <Badge tone="warning">{sorted.length}</Badge>}
        </span>
      }
      description={LOW_GRADE_RULE}
    >
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{NO_LOW_GRADE}ในวิชานี้</p>
      ) : (
        <>
          <ul className="-mx-2 divide-y divide-slate-100">
            {visible.map((s) => (
              <li key={s.studentProfileId}>
                <Link
                  href={`/instructor/courses/${courseId}?tab=students&student=${s.studentProfileId}`}
                  className="interactive-row flex min-h-14 items-center gap-3 rounded-lg px-2 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  <InitialsAvatar name={s.fullName} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span
                        className="truncate text-sm font-medium text-primary"
                        title={s.fullName}
                      >
                        {s.fullName}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {s.studentCode}
                      </span>
                    </span>
                    <span className="block truncate whitespace-nowrap text-xs text-muted-foreground">
                      {formatSemesterLabel(s.semesterTerm, s.academicYear)}
                    </span>
                  </span>
                  <GradeChip grade={s.grade} />
                  <ArrowRight
                    size={16}
                    aria-hidden="true"
                    className="go-arrow shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <Link
              href={`/instructor/courses/${courseId}?tab=students`}
              className="interactive-row inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              ดูอีก {hidden} คนในแท็บนิสิต
              <ArrowRight size={16} aria-hidden="true" className="go-arrow" />
            </Link>
          )}
        </>
      )}
    </SectionCard>
  );
}
