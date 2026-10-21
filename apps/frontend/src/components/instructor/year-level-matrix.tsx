import Link from 'next/link';
import { yearLevelLabel } from '@/lib/course-timeline-summary';
import {
  formatCourseGpa,
  formatGradeList,
  formatMedian,
  summarizeGradeCenter,
} from '@/lib/grade-center';
import type { GroupStats, Matrix, MatrixCell } from '@/lib/instructor-overview';
import { cn } from '@/lib/utils';
import { gpaTone } from '@/components/ui/gpa-scale';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { TEXT_LABEL } from './instructor-ui';

// One cell: the middle grade as a badge toned by the group's GPA band (the letter
// is always written) with "GPA x.xx" beside it, then one small muted line, the
// registrations and the F count when there is one. Under 5 graded people there is
// no middle grade, only a flat note. `mode` adds the most common grade to the
// second line, used in the whole-course column.
function Figure({
  stats,
  end = false,
  mode = false,
}: Readonly<{ stats: GroupStats; end?: boolean; mode?: boolean }>) {
  const center = summarizeGradeCenter(stats.counts);
  const values = center.values;
  const meta = [
    `การลงทะเบียน ${stats.seats} รายการ`,
    stats.f > 0 ? `F ${stats.f}` : null,
    mode && values ? `พบมากที่สุด ${formatGradeList(values.modes)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <span className={cn('flex min-w-0 flex-col gap-1', end && 'items-end text-right')}>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {values ? (
          <>
            <Badge
              tone={gpaTone(values.gpa)}
              className="min-w-10 justify-center whitespace-nowrap px-2.5 text-sm tabular-nums"
            >
              {formatMedian(values.median)}
            </Badge>
            <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
              GPA {formatCourseGpa(values.gpa)}
            </span>
          </>
        ) : (
          <span className="inline-flex whitespace-nowrap rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-xs text-muted-foreground">
            นิสิตน้อย
          </span>
        )}
      </span>
      <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{meta}</span>
    </span>
  );
}

// An empty cell is a quiet dash.
function Cell({ cell, end = false }: Readonly<{ cell: MatrixCell | null; end?: boolean }>) {
  if (!cell) {
    return (
      <span className={cn('block text-slate-500', end && 'text-right')} aria-label="ไม่มีนิสิต">
        –
      </span>
    );
  }
  return <Figure stats={cell.stats} end={end} />;
}

const href = (id: string) => `/instructor/courses/${id}`;

// The course column stays at the left while the figures scroll under it.
const COURSE_COL = 'sticky left-0 z-10 w-40 min-w-40 text-left sm:w-60 sm:min-w-60';

// Every course against every year level that has someone, one figure in every
// cell. One table at every width, meant to sit flush inside a SectionCard: on a
// narrow screen it scrolls sideways and the course column stays at the left. The
// course name is the link.
export function YearLevelMatrix({ matrix }: Readonly<{ matrix: Matrix }>) {
  const { levels, rows, footer } = matrix;
  return (
    <>
      <DataTable bordered={false} flush className="min-w-[44rem]">
        <caption className="sr-only">เกรดกลาง แยกตามวิชาและชั้นปี</caption>
        <thead>
          <tr>
            <th scope="col" className={COURSE_COL}>
              วิชา
            </th>
            {levels.map((l) => (
              <th key={l} scope="col">
                {yearLevelLabel(l)}
              </th>
            ))}
            <th scope="col">รวมวิชานี้</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.course.courseId} className="interactive-row">
              <th scope="row" className={cn(COURSE_COL, 'bg-card align-top font-normal')}>
                <Link
                  href={href(row.course.courseId)}
                  className="inline-flex min-h-11 items-center before:absolute before:inset-0 focus-visible:outline-none focus-visible:before:ring-2 focus-visible:before:ring-ring"
                >
                  <span className="min-w-0">
                    <span className={cn('block', TEXT_LABEL)}>{row.course.code}</span>
                    <span
                      className="course-name-break line-clamp-2 font-semibold text-primary"
                      title={row.course.name}
                    >
                      {row.course.name}
                    </span>
                  </span>
                </Link>
              </th>
              {row.cells.map((c, i) => (
                <td key={levels[i]} className="align-top">
                  <Cell cell={c} />
                </td>
              ))}
              <td className="align-top">
                <Figure stats={row.total} mode />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className={cn(COURSE_COL, 'align-top text-primary')}>
              ทุกวิชารวมกัน
            </th>
            {footer.cells.map((c, i) => (
              <td key={levels[i]} className="align-top">
                <Cell cell={c} />
              </td>
            ))}
            <td className="align-top">
              <Figure stats={footer.total} mode />
            </td>
          </tr>
        </tfoot>
      </DataTable>
    </>
  );
}
