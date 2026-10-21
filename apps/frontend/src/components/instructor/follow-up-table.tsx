import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import type { FollowUpRow } from '@/lib/instructor-dashboard';
import { LOW_GRADE_RULE, NO_LOW_GRADE } from '@/lib/low-grade';
import { cn } from '@/lib/utils';
import { DataTable } from '@/components/ui/data-table';
import { PageSection } from '@/components/layout/page-section';
import { StatusBadge } from '@/components/staff/status-badge';
import { GradeChip } from './grade-chip';
import { CARD, CARD_PAD, TEXT_SECTION } from './instructor-ui';

// Same table as the STAFF student list (staff-student-list.tsx), with what the
// instructor API carries: the grade of this course and its per-course status
// (riskLevel of that one grade) instead of the cumulative GPA and academic
// status, which the instructor endpoints do not return.

// Stretched over the whole row (the row is `relative`), so the row is one real
// link; the focus ring is drawn on the row because the link itself has no box.
const ROW_LINK =
  'font-semibold text-primary outline-none after:absolute after:inset-0 after:content-[""]';

const hrefOf = (row: FollowUpRow) =>
  `/instructor/courses/${row.courseId}?tab=students&student=${row.studentProfileId}`;

function Action() {
  return (
    <span className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground transition-colors [@media(hover:hover)]:group-hover:text-primary group-has-[:focus-visible]:text-primary">
      ดูรายละเอียด
      <ChevronRight
        aria-hidden="true"
        className="h-4 w-4 transition-transform [@media(hover:hover)]:group-hover:translate-x-0.5 group-has-[:focus-visible]:translate-x-0.5 motion-reduce:transition-none"
      />
    </span>
  );
}

function NameCell({ row }: Readonly<{ row: FollowUpRow }>) {
  return (
    <Link href={hrefOf(row)} className={cn(ROW_LINK, 'break-words')}>
      {row.fullName}
      <span className="sr-only"> ดูรายละเอียดในวิชา {row.courseCode}</span>
    </Link>
  );
}

function CourseLine({ row }: Readonly<{ row: FollowUpRow }>) {
  return (
    <p className="break-words text-xs text-muted-foreground">
      <span className="font-mono">{row.courseCode}</span> {row.courseName}
    </p>
  );
}

export function FollowUpTable({
  rows,
  total,
  people,
  yearLevelOf,
}: Readonly<{
  rows: FollowUpRow[];
  total: number;
  people: number;
  // null while the year levels are loading or failed: shown as "—".
  yearLevelOf: ((studentProfileId: string) => number | undefined) | null;
}>) {
  const yearText = (row: FollowUpRow) => {
    const level = yearLevelOf?.(row.studentProfileId);
    return level === undefined ? '—' : `ปี ${level}`;
  };
  const hidden = total - rows.length;

  return (
    <PageSection
      title={people > 0 ? `นิสิตที่ควรติดตาม (${people} คน)` : 'นิสิตที่ควรติดตาม'}
      titleClassName={TEXT_SECTION}
      description={`${LOW_GRADE_RULE} เรียงจากเกรดต่ำสุด`}
    >
      {rows.length === 0 ? (
        <p className={cn(CARD, CARD_PAD, 'text-sm text-muted-foreground')}>
          {NO_LOW_GRADE}ในวิชาที่คุณสอน
        </p>
      ) : (
        <div className="space-y-3">
          {/* From lg: below it the six columns wrap their chips, so phones and tablets get cards. */}
          <div className="hidden lg:block">
            <DataTable>
              <thead>
                <tr>
                  <th>รหัสนิสิต</th>
                  <th>ชื่อ-นามสกุล</th>
                  <th className="whitespace-nowrap">ชั้นปี</th>
                  <th className="whitespace-nowrap">เกรดของวิชา</th>
                  <th className="whitespace-nowrap">สถานะ</th>
                  <th className="whitespace-nowrap">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${row.courseId}:${row.studentProfileId}`}
                    className="interactive-row group relative border-b border-slate-100 align-middle"
                  >
                    <td className="font-semibold tabular-nums">{row.studentCode}</td>
                    <td>
                      <p>
                        <NameCell row={row} />
                      </p>
                      <CourseLine row={row} />
                    </td>
                    <td className="whitespace-nowrap tabular-nums">{yearText(row)}</td>
                    <td>
                      <GradeChip grade={row.grade} />
                    </td>
                    <td className="whitespace-nowrap">
                      <StatusBadge status={row.riskLevel} />
                    </td>
                    <td className="whitespace-nowrap">
                      <Action />
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {rows.map((row) => (
              <li
                key={`${row.courseId}:${row.studentProfileId}`}
                className="interactive-card group relative space-y-3 rounded-lg border border-slate-200 bg-card p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold tabular-nums">{row.studentCode}</p>
                  <StatusBadge status={row.riskLevel} />
                </div>
                <div>
                  <p>
                    <NameCell row={row} />
                  </p>
                  <CourseLine row={row} />
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">ชั้นปี</dt>
                    <dd className="tabular-nums">{yearText(row)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">เกรดของวิชา</dt>
                    <dd>
                      <GradeChip grade={row.grade} />
                    </dd>
                  </div>
                </dl>
                <div className="flex">
                  <Action />
                </div>
              </li>
            ))}
          </ul>

          <Link
            href="/instructor/students?grade=low"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            {hidden > 0 ? `ดูอีก ${hidden} รายการในหน้านิสิต` : 'ดูทั้งหมดในหน้านิสิต'}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      )}
    </PageSection>
  );
}
