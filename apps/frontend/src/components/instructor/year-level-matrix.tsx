import Link from 'next/link';
import { yearLevelLabel } from '@/lib/course-timeline-summary';
import {
  formatCourseGpa,
  formatGradeList,
  formatMedian,
  medianShade,
  summarizeGradeCenter,
} from '@/lib/grade-center';
import type { GroupStats, Matrix, MatrixCell } from '@/lib/instructor-overview';
import { cn } from '@/lib/utils';
import { CARD, TEXT_LABEL } from './instructor-ui';

// One cell, two lines. First: the middle grade on a one-hue tint (darker for a
// higher grade; the letter is always written) with "GPA x.xx" beside it. Second:
// plain small grey text, the seats and the F count when there is one. Under 5
// graded people there is no middle grade, only a flat note. `mode` adds the most
// common grade to the second line, used in the whole-course column.
function Figure({
  stats,
  end = false,
  mode = false,
}: Readonly<{ stats: GroupStats; end?: boolean; mode?: boolean }>) {
  const center = summarizeGradeCenter(stats.counts);
  const values = center.values;
  return (
    <span className={cn('flex min-h-14 min-w-0 flex-col gap-1', end && 'items-end text-right')}>
      <span className={cn('flex flex-wrap items-center gap-x-2 gap-y-1', end && 'justify-end')}>
        {values ? (
          <>
            <span
              className="inline-flex min-w-14 justify-center rounded-md px-2 py-0.5 text-xl font-semibold leading-tight tabular-nums text-primary"
              style={{ backgroundColor: `rgba(37, 99, 235, ${medianShade(values.median)})` }}
            >
              {formatMedian(values.median)}
            </span>
            <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
              GPA {formatCourseGpa(values.gpa)}
            </span>
          </>
        ) : (
          <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[13px] text-muted-foreground">
            ข้อมูลยังน้อย
          </span>
        )}
      </span>
      <span className={cn('text-[13px] tabular-nums text-muted-foreground', end && 'text-right')}>
        {stats.seats} ที่นั่ง
        {stats.f > 0 && ` · F ${stats.f}`}
        {mode && values && ` · พบมากที่สุด ${formatGradeList(values.modes)}`}
      </span>
    </span>
  );
}

// An empty cell is a quiet dash.
function Cell({ cell, end = false }: Readonly<{ cell: MatrixCell | null; end?: boolean }>) {
  if (!cell) {
    return (
      <span className={cn('block text-slate-300', end && 'text-right')} aria-label="ไม่มีนิสิต">
        –
      </span>
    );
  }
  return <Figure stats={cell.stats} end={end} />;
}

const href = (id: string) => `/instructor/courses/${id}`;

// Every course against every year level that has someone, one figure in every
// cell. A table from lg up (the course name is the link; the row is clickable
// through it) and one card per course below, with the year levels as a list.
export function YearLevelMatrix({ matrix }: Readonly<{ matrix: Matrix }>) {
  const { levels, rows, footer } = matrix;
  return (
    <>
      <div className={cn('hidden overflow-x-auto lg:block', CARD)}>
        <table className="w-full text-sm">
          <caption className="sr-only">เกรดกลาง แยกตามวิชาและชั้นปี</caption>
          <thead>
            <tr className="border-b bg-slate-50 text-left text-[13px] text-muted-foreground">
              <th scope="col" className="px-4 py-2 font-medium">
                วิชา
              </th>
              {levels.map((l) => (
                <th key={l} scope="col" className="px-4 py-2 font-medium">
                  {yearLevelLabel(l)}
                </th>
              ))}
              <th scope="col" className="px-4 py-2 font-medium">
                รวมวิชานี้
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.course.courseId} className="relative border-b hover:bg-slate-50">
                <th scope="row" className="px-4 py-3 text-left align-top font-normal">
                  <Link
                    href={href(row.course.courseId)}
                    className="inline-flex min-h-11 items-center before:absolute before:inset-0 focus-visible:outline-none focus-visible:before:ring-2 focus-visible:before:ring-ring"
                  >
                    <span>
                      <span className={cn('block', TEXT_LABEL)}>{row.course.code}</span>
                      <span className="block font-semibold text-primary">{row.course.name}</span>
                    </span>
                  </Link>
                </th>
                {row.cells.map((c, i) => (
                  <td key={levels[i]} className="px-4 py-3 align-top">
                    <Cell cell={c} />
                  </td>
                ))}
                <td className="px-4 py-3 align-top">
                  <Figure stats={row.total} mode />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-50">
              <th scope="row" className="px-4 py-3 text-left align-top font-semibold text-primary">
                ทุกวิชารวมกัน
              </th>
              {footer.cells.map((c, i) => (
                <td key={levels[i]} className="px-4 py-3 align-top">
                  <Cell cell={c} />
                </td>
              ))}
              <td className="px-4 py-3 align-top">
                <Figure stats={footer.total} mode />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <ul className="space-y-3 lg:hidden">
        {rows.map((row) => (
          <li key={row.course.courseId}>
            <Link
              href={href(row.course.courseId)}
              className={cn(
                'block space-y-3 p-4 transition hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                CARD,
              )}
            >
              <span className="block min-w-0">
                <span className={cn('block', TEXT_LABEL)}>{row.course.code}</span>
                <span className="block break-words font-semibold text-primary">
                  {row.course.name}
                </span>
              </span>
              <span className="block divide-y">
                {levels.map((l, i) => (
                  <span key={l} className="flex items-start justify-between gap-3 py-2">
                    <span className="min-h-11 pt-1 text-sm text-muted-foreground">
                      {yearLevelLabel(l)}
                    </span>
                    <Cell cell={row.cells[i]} end />
                  </span>
                ))}
                <span className="flex items-start justify-between gap-3 pt-2">
                  <span className="min-h-11 pt-1 text-sm font-medium text-primary">รวมวิชานี้</span>
                  <Figure stats={row.total} end mode />
                </span>
              </span>
            </Link>
          </li>
        ))}
        <li className={cn('space-y-3 border-t-2 border-slate-300 p-4', CARD)}>
          <span className="block font-semibold text-primary">ทุกวิชารวมกัน</span>
          <span className="block divide-y">
            {levels.map((l, i) => (
              <span key={l} className="flex items-start justify-between gap-3 py-2">
                <span className="min-h-11 pt-1 text-sm text-muted-foreground">
                  {yearLevelLabel(l)}
                </span>
                <Cell cell={footer.cells[i]} end />
              </span>
            ))}
            <span className="flex items-start justify-between gap-3 pt-2">
              <span className="min-h-11 pt-1 text-sm font-medium text-primary">รวม</span>
              <Figure stats={footer.total} end mode />
            </span>
          </span>
        </li>
      </ul>
    </>
  );
}
