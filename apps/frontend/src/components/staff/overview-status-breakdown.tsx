import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { StatusBadge } from './status-badge';
import {
  STATUS_RULES,
  sharePercent,
  type StaffStatusKey,
  type StudentSummary,
} from './staff-status';

const ROWS: {
  key: Exclude<StaffStatusKey, 'SUSPENDED'>;
  rule: string;
  bar: string;
}[] = [
  { key: 'NORMAL', rule: STATUS_RULES.NORMAL, bar: 'bg-emerald-500' },
  { key: 'WATCH', rule: STATUS_RULES.WATCH, bar: 'bg-amber-500' },
  { key: 'CRITICAL', rule: STATUS_RULES.CRITICAL, bar: 'bg-red-500' },
  {
    key: 'NO_DATA',
    rule: STATUS_RULES.NO_DATA,
    bar: 'bg-slate-300',
  },
];

// The four statuses split the active students, so the bar and the rows add up
// to the figure on the first card. Suspended students sit below the line.
export function OverviewStatusBreakdown({ summary }: Readonly<{ summary: StudentSummary }>) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg">สัดส่วนสถานะนิสิต</CardTitle>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            ฐาน {summary.active} คน
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          จัดระดับจากเกรดที่แย่ที่สุดของนิสิตแต่ละคน
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div aria-hidden="true" className="flex h-3 overflow-hidden rounded-full bg-slate-100">
          {ROWS.map(({ key, bar }) => (
            <div
              key={key}
              className={bar}
              style={{
                width: `${summary.active ? (summary.byStatus[key] / summary.active) * 100 : 0}%`,
              }}
            />
          ))}
        </div>
        <ul className="space-y-2">
          {ROWS.map(({ key, rule }) => (
            <li key={key}>
              <Link
                href={`/staff/students?risk=${key}`}
                className={cn(
                  'flex min-h-11 items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50',
                )}
              >
                <span className="min-w-0 space-y-1">
                  <StatusBadge status={key} />
                  <span className="block break-words text-xs text-muted-foreground">{rule}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-lg font-semibold tabular-nums text-primary">
                    {summary.byStatus[key]} คน
                  </span>
                  <span className="block text-xs tabular-nums text-muted-foreground">
                    {sharePercent(summary.byStatus[key], summary.active)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/staff/students?risk=SUSPENDED"
          className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100"
        >
          <StatusBadge status="SUSPENDED" />
          <span className="text-muted-foreground">
            พักการเรียน / ระงับ <span className="tabular-nums">{summary.suspended}</span> คน
            (ไม่นับรวม)
          </span>
        </Link>
      </CardContent>
    </Card>
  );
}
