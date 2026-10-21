import type { RadarPoint } from '@eduanalyze-ai/shared-types';
import { formatFiveScale } from '@/lib/five-scale';
import { ploProgressBarColorClassName } from '@/lib/plo-color';
import { Progress } from '@/components/ui/progress';

// Same 0–5 scale as the radar it sits under, so a PLO never reads as
// "2.5" on the chart and "50%" in the list right below it. The scale's top is
// written with the same formatter as the value ("5.0" or "5.00"), so the two
// always agree.
//
// With a `threshold` (the same bar the list above judges "ผ่าน / ยังไม่ผ่าน" by) each bar
// gets a tick at that level, and a bar under it takes the soft warning colour (passing bars the green of the 'ผ่าน' badge) plus the
// words "ยังไม่ผ่านเกณฑ์", so the state never rests on colour alone.
export function PloProgressTable({
  radar,
  formatValue = formatFiveScale,
  threshold = null,
}: Readonly<{
  radar: RadarPoint[];
  formatValue?: (percent: number | null, noDataLabel?: string) => string;
  threshold?: number | null;
}>) {
  return (
    <ul className="space-y-4">
      {radar.map((plo) => {
        const below = threshold !== null && plo.value !== null && plo.value < threshold;
        return (
          <li key={plo.ploId} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0">
                <span className="font-medium text-primary">{plo.code}</span>{' '}
                <span className="text-muted-foreground">{plo.name}</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums text-primary">
                {formatValue(plo.value, 'ไม่มีข้อมูล')}
                {plo.value !== null && (
                  <span className="font-normal text-muted-foreground"> / {formatValue(100)}</span>
                )}
              </span>
            </div>
            <div className="relative">
              <Progress
                value={plo.value ?? 0}
                label={`${plo.code} ${plo.name}`}
                barClassName={
                  plo.value !== null && threshold !== null
                    ? ploProgressBarColorClassName(plo.value, threshold)
                    : undefined
                }
              />
              {threshold !== null && (
                <span
                  aria-hidden="true"
                  className="absolute -top-0.5 h-3 w-0.5 -translate-x-1/2 rounded-full bg-primary"
                  style={{ left: `${Math.max(0, Math.min(100, threshold))}%` }}
                />
              )}
            </div>
            {below && <p className="text-xs text-muted-foreground">ยังไม่ผ่านเกณฑ์</p>}
          </li>
        );
      })}
    </ul>
  );
}
