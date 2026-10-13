import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { readGroupGpa, type YearRow } from './staff-status';
import { BEHIND_PLAN_FORMULA, describeEmptyYears, yearLevelTitle } from './year-info';

function GpaCell({
  row,
  align = 'right',
}: {
  row: Pick<YearRow, 'summary'>;
  align?: 'left' | 'right';
}) {
  const reading = readGroupGpa(row.summary.averageGpa, row.summary.withGpa);
  return (
    <div className={align === 'right' ? 'text-right' : undefined}>
      {reading.value && (
        <p className="text-base font-semibold tabular-nums text-primary">{reading.value}</p>
      )}
      <p className="break-words text-xs text-muted-foreground">{reading.note}</p>
    </div>
  );
}

// Both bars sit in a fixed 12px box and are centred in it, so thickening on row
// hover changes the bar alone and the row never moves.
const BAR =
  'absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 transition-[height] duration-200 [@media(hover:hover)]:group-hover/row:h-3 group-has-[:focus-visible]/row:h-3';

// One bar per row: the amber part is every student at "watch" or worse, the red
// part drawn over it is the "critical" ones, so the bar reads as the share of
// the year that needs follow-up. The counts are written under it in words.
function RiskCell({ row }: { row: Pick<YearRow, 'summary'> }) {
  const { CRITICAL, WATCH } = row.summary.byStatus;
  if (CRITICAL === 0 && WATCH === 0) return <span className="text-muted-foreground">ไม่มี</span>;
  const { active } = row.summary;
  const share = (count: number) => (active === 0 ? 0 : (count / active) * 100);
  return (
    <div className="min-w-32 space-y-1.5">
      <div
        className="relative h-3"
        role="img"
        aria-label={`เร่งด่วน ${CRITICAL} คน เฝ้าระวัง ${WATCH} คน จากนิสิต ${active} คน`}
      >
        <Progress value={share(CRITICAL + WATCH)} barClassName="bg-amber-500" className={BAR} />
        <Progress
          value={share(CRITICAL)}
          barClassName="bg-red-500"
          className={`${BAR} bg-transparent`}
        />
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">
        เร่งด่วน <span className="font-semibold text-red-700">{CRITICAL}</span> · เฝ้าระวัง{' '}
        <span className="font-semibold text-amber-700">{WATCH}</span>
      </p>
    </div>
  );
}

// Every figure comes from the same summary the cards above use, so the total
// row is the card figures again, not a second count.
export function OverviewYearTable({
  years,
  total,
  totalBehind,
}: Readonly<{
  years: YearRow[];
  total: YearRow['summary'];
  totalBehind: number;
}>) {
  const totalRow = { summary: total };
  const populated = years.filter((row) => row.summary.active > 0);
  const emptyYears = describeEmptyYears(
    years.filter((row) => row.summary.active === 0).map((row) => row.yearLevel),
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">สถิติผลการเรียนจำแนกตามชั้นปี</CardTitle>
        <p className="text-sm text-muted-foreground">
          เฉพาะนิสิตที่ใช้งานอยู่ เลือกชั้นปีเพื่อดูรายชื่อ
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b-2 border-slate-200 text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-semibold">ชั้นปี</th>
              <th className="py-2 pr-3 text-right font-semibold">นิสิต (คน)</th>
              <th className="py-2 pr-3 text-right font-semibold">มีผลการเรียน (คน)</th>
              <th className="py-2 pr-3 text-right font-semibold">GPA เฉลี่ย</th>
              <th className="py-2 pr-3 font-semibold">สัดส่วนเร่งด่วน / เฝ้าระวัง</th>
              <th className="py-2 text-right font-semibold">ตามหลังแผน (คน)</th>
            </tr>
          </thead>
          <tbody>
            {populated.map((row) => (
              <tr
                key={row.yearLevel}
                className="interactive-row group/row relative border-b border-slate-100 align-top"
              >
                <td className="py-1 pr-3">
                  <Link
                    href={`/staff/students?level=${row.yearLevel}`}
                    className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap font-semibold text-primary outline-none after:absolute after:inset-0 after:content-[''] hover:underline"
                  >
                    {yearLevelTitle(row.yearLevel)}
                    <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </Link>
                </td>
                <td className="py-3 pr-3 text-right tabular-nums">{row.summary.active}</td>
                <td className="py-3 pr-3 text-right tabular-nums">{row.summary.withRecords}</td>
                <td className="py-3 pr-3">
                  <GpaCell row={row} />
                </td>
                <td className="py-3 pr-3">
                  <RiskCell row={row} />
                </td>
                <td className="py-3 text-right tabular-nums">{row.behind}</td>
              </tr>
            ))}
            {emptyYears && (
              <tr className="border-b border-slate-100">
                <td colSpan={6} className="py-3 text-sm text-muted-foreground">
                  {emptyYears}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 align-top font-semibold">
              <td className="py-3 pr-3">รวมทั้งสิ้น</td>
              <td className="py-3 pr-3 text-right tabular-nums">{total.active} คน</td>
              <td className="py-3 pr-3 text-right tabular-nums">{total.withRecords} คน</td>
              <td className="py-3 pr-3">
                <GpaCell row={totalRow} />
              </td>
              <td className="py-3 pr-3">
                <RiskCell row={totalRow} />
              </td>
              <td className="py-3 text-right tabular-nums">{totalBehind} คน</td>
            </tr>
          </tfoot>
        </table>
        </div>

        <ul className="space-y-3 md:hidden">
          {[
            ...populated.map((row) => ({
              row,
              title: yearLevelTitle(row.yearLevel),
              href: `/staff/students?level=${row.yearLevel}`,
              behind: row.behind,
            })),
            {
              row: totalRow,
              title: 'รวมทั้งสิ้น',
              href: null,
              behind: totalBehind,
            },
          ].map(({ row, title, href, behind }) => (
            <li key={title} className="rounded-lg border border-slate-200 p-3">
              {href ? (
                <Link
                  href={href}
                  className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap font-semibold text-primary hover:underline"
                >
                  {title}
                  <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <p className="font-semibold text-primary">{title}</p>
              )}
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">นิสิต (คน)</dt>
                  <dd className="tabular-nums">{row.summary.active}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">มีผลการเรียน (คน)</dt>
                  <dd className="tabular-nums">{row.summary.withRecords}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">GPA เฉลี่ย</dt>
                  <dd>
                    <GpaCell row={row} align="left" />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">สัดส่วนเร่งด่วน / เฝ้าระวัง</dt>
                  <dd>
                    <RiskCell row={row} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">ตามหลังแผน (คน)</dt>
                  <dd className="tabular-nums">{behind}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
        {emptyYears && <p className="text-sm text-muted-foreground md:hidden">{emptyYears}</p>}

        <p className="text-xs text-muted-foreground">{BEHIND_PLAN_FORMULA}</p>
      </CardContent>
    </Card>
  );
}
