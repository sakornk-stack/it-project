import { formatFiveScaleAgainstThreshold, percentToFiveScale } from '@/lib/five-scale';
import { SCORE_BANDS, type ScoreBandKey } from '@/lib/plo-score-bands';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GradeEstimateBadge } from '@/components/ui/grade-estimate-badge';
import { CollapsibleSection } from '@/components/ui/collapsible-section';

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const RING_SIZE = 112;

// The 5.0 scale is a straight conversion of the percent (percent / 20, one decimal), so each
// band minimum has an exact equivalent; 0% needs none.
function bandThresholdText(band: (typeof SCORE_BANDS)[number]) {
  return band.minimum === 0
    ? `${band.label} (ตั้งแต่ 0%)`
    : `${band.label} (ตั้งแต่ ${band.minimum}% หรือ ${percentToFiveScale(band.minimum).toFixed(1)} จาก 5.0)`;
}

// No chart library in this project (confirmed — plain SVG ring, same
// no-dependency style as the hand-rolled linear Progress component).
//
// Ring and status breakdown are one Card, two halves; the long explanation of
// the bands lives in a collapsed "how to read" section below the Card.
export function OverallAchievementCard({
  percent,
  isAchieved,
  threshold,
  bandCounts,
  noDataCount,
}: Readonly<{
  percent: number | null;
  isAchieved: boolean;
  threshold: number | null;
  bandCounts: Record<ScoreBandKey, number>;
  noDataCount: number;
}>) {
  const clamped = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);
  const badgeTone = percent !== null && isAchieved ? 'success' : 'neutral';
  const badgeLabel =
    percent === null ? 'ไม่มีข้อมูล' : isAchieved ? 'ผ่านเกณฑ์' : 'ยังไม่ผ่านเกณฑ์';
  const total = SCORE_BANDS.reduce((sum, band) => sum + bandCounts[band.key], 0);
  const summary = SCORE_BANDS.map((band) => `${band.label} ${bandCounts[band.key]} PLO`).join(' ');

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle>ภาพรวมความสำเร็จของ PLO</CardTitle>
          <GradeEstimateBadge />
        </CardHeader>
        <CardContent className="grid grid-cols-1 items-center gap-8 sm:grid-cols-[auto_1fr] sm:gap-10">
          <div className="flex flex-col items-center gap-2">
            <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
              <svg
                width={RING_SIZE}
                height={RING_SIZE}
                viewBox="0 0 140 140"
                className="-rotate-90"
                aria-hidden="true"
                focusable="false"
              >
                <circle
                  cx={70}
                  cy={70}
                  r={RADIUS}
                  strokeWidth={8}
                  className="fill-none stroke-slate-100"
                />
                {percent !== null && (
                  <circle
                    cx={70}
                    cy={70}
                    r={RADIUS}
                    strokeWidth={8}
                    strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={offset}
                    className="fill-none stroke-brand transition-all motion-reduce:transition-none"
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                <span className="text-3xl font-semibold tabular-nums text-primary">
                  {formatFiveScaleAgainstThreshold(percent, threshold, isAchieved)}
                </span>
                {percent !== null && (
                  <span className="mt-1 text-xs text-muted-foreground">/ 5.0</span>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">คะแนนเฉลี่ย</p>
            <Badge tone={badgeTone} className="px-3 py-1 text-sm">
              {badgeLabel}
            </Badge>
          </div>

          <div className="min-w-0 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">สรุปตามคะแนน</h3>
              <p className="text-xs text-muted-foreground">จำนวน PLO ในแต่ละระดับคะแนน</p>
            </div>
            {total > 0 && (
              <div
                role="img"
                aria-label={`สัดส่วน PLO ตามระดับคะแนน: ${summary}`}
                className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
              >
                {SCORE_BANDS.map(
                  (band) =>
                    bandCounts[band.key] > 0 && (
                      <div
                        key={band.key}
                        className={band.indicatorClassName}
                        style={{ width: `${(bandCounts[band.key] / total) * 100}%` }}
                      />
                    ),
                )}
              </div>
            )}
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {SCORE_BANDS.map((band) => (
                <li key={band.key} className="flex items-center gap-2">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span
                      className={cn('h-2 w-2 shrink-0 rounded-full', band.indicatorClassName)}
                      aria-hidden="true"
                    />
                    {band.label}
                  </span>
                  <span className="font-medium tabular-nums text-primary">
                    {bandCounts[band.key]} PLO
                  </span>
                </li>
              ))}
            </ul>
            {noDataCount > 0 && (
              <p className="border-t border-slate-100 pt-3 text-xs text-muted-foreground">
                ไม่มีข้อมูล {noDataCount} PLO
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <CollapsibleSection title="วิธีอ่านผล" framed={false}>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            การสรุปตามคะแนนจัดกลุ่มตามเกณฑ์ทั่วไป (
            {SCORE_BANDS.map((b) => b.minimum)
              .slice(0, 3)
              .join('/')}
            ) ได้แก่ {SCORE_BANDS.map((b) => bandThresholdText(b)).join(', ')}
          </p>
          <p>
            การจัดกลุ่มนี้แยกจาก &quot;ผ่านเกณฑ์&quot; ของแต่ละ PLO ด้านล่าง
            ซึ่งเทียบกับเกณฑ์ที่หลักสูตรนี้กำหนดเอง
          </p>
        </div>
      </CollapsibleSection>
    </div>
  );
}
