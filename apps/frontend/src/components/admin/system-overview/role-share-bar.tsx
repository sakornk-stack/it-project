'use client';

import { Card, CardContent } from '@/components/ui/card';
import { roleShares, type SystemUserCounts } from '@/lib/system-overview';
import { useInView } from '@/lib/use-in-view';
import { cn } from '@/lib/utils';
import { overviewRoleMeta } from './role-meta';

const number = (n: number) => n.toLocaleString('th-TH');
const percentText = (percent: number) => `${percent.toFixed(percent % 1 === 0 ? 0 : 1)}%`;

// One stacked bar: each role's width is its real share of the accounts. The legend carries
// the label, count and percentage in text, so the colours are never the only signal.
// The segments grow once, when the bar first scrolls into view.
export function RoleShareBar({ counts }: Readonly<{ counts: SystemUserCounts }>) {
  const { ref, seen } = useInView<HTMLDivElement>();
  const rows = roleShares(counts).map((share) => ({
    ...share,
    meta: overviewRoleMeta(share.role),
  }));
  const summary = rows
    .map(
      ({ meta, count, percent }) => `${meta.label} ${number(count)} คน (${percentText(percent)})`,
    )
    .join(', ');

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div
          ref={ref}
          role="img"
          aria-label={`สัดส่วนผู้ใช้งานตามบทบาท: ${summary}`}
          className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-slate-100"
        >
          {rows
            .filter((row) => row.count > 0)
            .map(({ role, meta, count, percent }) => (
              <div
                key={role}
                title={`${meta.label} ${number(count)} คน (${percentText(percent)})`}
                className={cn(
                  'h-full min-w-1 transition-[width] duration-700 ease-out motion-reduce:transition-none',
                  meta.fill,
                )}
                style={{ width: seen ? `${percent}%` : '0%' }}
              />
            ))}
        </div>
        <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
          {rows.map(({ role, meta, count, percent }) => (
            <li key={role} className="flex min-w-0 items-center gap-2 text-sm">
              <span
                aria-hidden="true"
                className={cn('h-2.5 w-2.5 shrink-0 rounded-full', meta.fill)}
              />
              <span className="min-w-0 break-words text-muted-foreground">{meta.label}</span>
              <span className="ml-auto shrink-0 tabular-nums">
                <span className="font-medium text-primary">{number(count)}</span>
                <span className="ml-1 text-xs text-muted-foreground">({percentText(percent)})</span>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
