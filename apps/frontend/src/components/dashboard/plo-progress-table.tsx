import type { RadarPoint } from '@eduanalyze-ai/shared-types';
import { formatFiveScale } from '@/lib/five-scale';
import { ploBarAriaLabel, ploBarStatus, ploTickPercent } from '@/lib/plo-bar';
import { ploProgressBarColorClassName, ploStatusTone } from '@/lib/plo-color';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

// Same 0–5 scale as the radar it sits under, so a PLO never reads as
// "2.5" on the chart and "50%" in the list right below it. The scale's top is
// written with the same formatter as the value ("5.0" or "5.00"), so the two
// always agree.
//
// With a `threshold` (the same bar the list above judges "ผ่าน / ยังไม่ผ่าน" by) each bar
// gets a tick at that level, and a bar under it takes the soft warning colour (passing bars the green of the 'ผ่าน' badge) plus the
// words "ยังไม่ผ่านเกณฑ์", so the state never rests on colour alone. The bar's accessible
// name spells out the verdict and the pass mark (ploBarAriaLabel).
//
// Used by the student dashboard and the ADMIN curriculum page. `showStatusBadge` is for a
// list with no separate verdict list above it (ADMIN): the "ผ่าน / ยังไม่ผ่าน" badge sits beside
// the score instead of the line under the bar, and the row wraps on a narrow screen. Off by
// default, so the student pages render exactly as before.
export function PloProgressTable({
  radar,
  formatValue = formatFiveScale,
  threshold = null,
  showStatusBadge = false,
}: Readonly<{
  radar: RadarPoint[];
  formatValue?: (percent: number | null, noDataLabel?: string) => string;
  threshold?: number | null;
  showStatusBadge?: boolean;
}>) {
  const tickPercent = ploTickPercent(threshold);
  return (
    <ul className="space-y-4">
      {radar.map((plo) => {
        const status = ploBarStatus(plo.value, threshold);
        const below = status === 'below';
        return (
          <li key={plo.ploId} className="space-y-1.5">
            <div
              className={cn(
                'flex items-baseline justify-between gap-3 text-sm',
                showStatusBadge && 'flex-wrap gap-y-1',
              )}
            >
              <span className={cn('min-w-0', showStatusBadge && 'break-words')}>
                <span className="font-medium text-primary">{plo.code}</span>{' '}
                <span className="text-muted-foreground">{plo.name}</span>
              </span>
              <span className={cn('shrink-0', showStatusBadge && 'flex items-center gap-2')}>
                <span className="font-medium tabular-nums text-primary">
                  {formatValue(plo.value, 'ไม่มีข้อมูล')}
                  {plo.value !== null && (
                    <span className="font-normal text-muted-foreground"> / {formatValue(100)}</span>
                  )}
                </span>
                {showStatusBadge && (status === 'passed' || below) && (
                  <Badge tone={ploStatusTone(plo.value, threshold)}>
                    {status === 'passed' ? 'ผ่าน' : 'ยังไม่ผ่าน'}
                  </Badge>
                )}
              </span>
            </div>
            <div className="relative">
              <Progress
                value={plo.value ?? 0}
                label={ploBarAriaLabel(plo.code, plo.name, plo.value, threshold)}
                barClassName={
                  plo.value !== null && threshold !== null
                    ? ploProgressBarColorClassName(plo.value, threshold)
                    : undefined
                }
              />
              {tickPercent !== null && (
                <span
                  aria-hidden="true"
                  className="absolute -top-0.5 h-3 w-0.5 -translate-x-1/2 rounded-full bg-primary"
                  style={{ left: `${tickPercent}%` }}
                />
              )}
            </div>
            {below && !showStatusBadge && (
              <p className="text-xs text-muted-foreground">ยังไม่ผ่านเกณฑ์</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
