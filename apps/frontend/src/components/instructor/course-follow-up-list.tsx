import Link from 'next/link';
import type { AtRiskStudent } from '@eduanalyze-ai/shared-types';
import { gradeBadgeTone } from '@/lib/grade-badge-color';
import { GRADE_LABELS, formatSemesterLabel } from '@/lib/grade-label';
import { LOW_GRADE_LABEL, LOW_GRADE_RULE, isLowGrade } from '@/lib/low-grade';
import { PageSection } from '@/components/layout/page-section';
import { Badge } from '@/components/ui/badge';
import { TEXT_SECTION } from './instructor-ui';

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
    <PageSection
      title={
        <span className="flex flex-wrap items-center gap-2">
          นิสิตที่{LOW_GRADE_LABEL}
          {sorted.length > 0 && <Badge tone="warning">{sorted.length}</Badge>}
        </span>
      }
      titleClassName={TEXT_SECTION}
      description={LOW_GRADE_RULE}
    >
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีนิสิตที่มีเกรด D+ ลงไปในวิชานี้</p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
            {visible.map((s) => (
              <li key={s.studentProfileId}>
                <Link
                  href={`/instructor/courses/${courseId}?tab=students&student=${s.studentProfileId}`}
                  className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 text-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0">
                    <span className="block text-primary">{s.fullName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {s.studentCode} · {formatSemesterLabel(s.semesterTerm, s.academicYear)}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={gradeBadgeTone(s.grade)}>เกรด {GRADE_LABELS[s.grade]}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <Link
              href={`/instructor/courses/${courseId}?tab=students`}
              className="inline-flex min-h-11 items-center text-sm text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ดูอีก {hidden} คนในแท็บนิสิต
            </Link>
          )}
        </>
      )}
    </PageSection>
  );
}
