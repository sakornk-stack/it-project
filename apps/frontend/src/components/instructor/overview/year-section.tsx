import { type ReactNode } from 'react';
import { GraduationCap } from 'lucide-react';
import { SPARSE_YEAR_NOTE, type CourseSnapshot, type YearRow } from '@/lib/course-snapshot';
import { yearLevelLabel } from '@/lib/course-timeline-summary';
import { formatPercent } from '@/lib/format-percent';
import { formatMedian, summarizeGradeCenter } from '@/lib/grade-center';
import { formatGpa } from '@/lib/instructor-overview';
import { DataTable } from '@/components/ui/data-table';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionCard } from '@/components/ui/section-card';
import { LowSampleTag } from '../overview-parts';

export function YearSection({
  snapshot,
  loading,
}: Readonly<{ snapshot: CourseSnapshot; loading: boolean }>) {
  const { years } = snapshot;
  const hasSparse = !!years && years.rows.some((r) => !r.showNumbers);
  const footer =
    years && (hasSparse || years.unplaced > 0) ? (
      <>
        {hasSparse && <p>{SPARSE_YEAR_NOTE}</p>}
        {years.unplaced > 0 && <p>{years.unplaced} คนหาชั้นปีไม่พบ จึงไม่อยู่ในตารางนี้</p>}
      </>
    ) : undefined;
  const hasRows = !loading && !!years && years.rows.length > 0;
  let body: ReactNode;
  if (loading) {
    body = <Skeleton className="h-28 w-full rounded-xl" />;
  } else if (years === null) {
    body = (
      <p className="text-sm text-muted-foreground">
        ยังโหลดข้อมูลชั้นปีไม่ได้ จึงยังแยกตามชั้นปีไม่ได้
      </p>
    );
  } else if (years.rows.length === 0) {
    body = <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลชั้นปีของนิสิตในวิชานี้</p>;
  } else {
    body = (
      <>
        <div className="hidden border-t md:block">
          <DataTable flush bordered={false} className="min-w-[34rem]">
            <thead>
              <tr>
                <th scope="col">ชั้นปี</th>
                <th scope="col" className="data-num">
                  นิสิต (คน)
                </th>
                <th scope="col" className="w-56">
                  ได้ B ขึ้นไป (%)
                </th>
                <th scope="col" className="data-num">
                  เกรดเฉลี่ย
                </th>
                <th scope="col" className="data-num">
                  เกรดกลาง
                </th>
              </tr>
            </thead>
            <tbody>
              {years.rows.map((row) => (
                <tr key={row.yearLevel} className="interactive-row">
                  <th scope="row" className="text-left text-base font-bold text-primary">
                    {yearLevelLabel(row.yearLevel)}
                  </th>
                  <td className="data-num">{row.stats.seats}</td>
                  <td>
                    <AchievedCell row={row} />
                  </td>
                  <td className="data-num">{row.showNumbers ? formatGpa(row.stats.gpa) : '—'}</td>
                  <td className="text-right">
                    <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                      <span className="text-base font-semibold tabular-nums text-primary">
                        {medianOf(row) ?? '—'}
                      </span>
                      {row.level === 'low' && <LowSampleTag counted={row.stats.graded} />}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </div>
        <ul className="grid gap-3 px-4 pb-4 sm:grid-cols-2 md:hidden">
          {years.rows.map((row) => (
            <YearListItem key={row.yearLevel} row={row} />
          ))}
        </ul>
      </>
    );
  }
  return (
    <SectionCard
      icon={GraduationCap}
      title="ภาพรวมตามชั้นปี"
      description="ชั้นปีของนิสิตเทียบกับปีการศึกษาล่าสุด แสดงเฉพาะชั้นปีที่มีนิสิตในวิชานี้"
      footer={footer}
      flush
    >
      {/* The table runs edge to edge under the header; everything else keeps the card padding. */}
      {hasRows ? body : <div className="px-4 pb-4 sm:px-6 sm:pb-6">{body}</div>}
    </SectionCard>
  );
}

// The share at B or above: the figure and the bar share one left edge and the
// bar takes the whole cell, so rows compare at a glance.
function AchievedCell({ row }: Readonly<{ row: YearRow }>) {
  return (
    <div className="space-y-1.5">
      <p className="text-lg font-semibold tabular-nums text-primary">
        {row.showNumbers ? formatPercent(row.stats.achievedPercent) : '—'}
      </p>
      {row.showNumbers && (
        <Progress
          value={row.stats.achievedPercent ?? 0}
          label={`ได้ B ขึ้นไป ${formatPercent(row.stats.achievedPercent)}`}
          barClassName="bg-brand"
        />
      )}
    </div>
  );
}

// The middle grade of one year level; null while there are too few people.
function medianOf(row: YearRow): string | null {
  const values = summarizeGradeCenter(row.stats.counts).values;
  return values && row.showNumbers ? formatMedian(values.median) : null;
}

// Phones and small tablets: one small card per year level, same figures as a table row.
function YearListItem({ row }: Readonly<{ row: YearRow }>) {
  const median = medianOf(row);
  return (
    <li className="space-y-3 rounded-lg border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-bold text-primary">{yearLevelLabel(row.yearLevel)}</p>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span className="text-sm tabular-nums text-muted-foreground">
            นิสิต {row.stats.seats} คน
          </span>
          {row.level === 'low' && <LowSampleTag counted={row.stats.graded} />}
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs text-muted-foreground">ได้ B ขึ้นไป</p>
        <AchievedCell row={row} />
      </div>
      <dl className="grid grid-cols-2 gap-3 border-t pt-3">
        <div>
          <dt className="text-xs text-muted-foreground">เกรดเฉลี่ย</dt>
          <dd className="font-semibold tabular-nums text-primary">
            {row.showNumbers ? formatGpa(row.stats.gpa) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">เกรดกลาง</dt>
          <dd className="font-semibold tabular-nums text-primary">{median ?? '—'}</dd>
        </div>
      </dl>
    </li>
  );
}
