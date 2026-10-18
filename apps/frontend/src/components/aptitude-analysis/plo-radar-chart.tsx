import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import type { RadarPoint } from '@eduanalyze-ai/shared-types';
import { formatFiveScaleAgainstThreshold } from '@/lib/five-scale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GradeEstimateBadge } from '@/components/ui/grade-estimate-badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const DEFAULT_SIZE = 320;
const RING_FRACTIONS = [0.25, 0.5, 0.75, 1];

// No chart library in this project — hand-built SVG, same no-dependency
// approach as overall-achievement-card.tsx's ring. Null-valued PLOs (no
// relevant CLO data yet) are plotted at the center so the polygon shape
// stays geometrically valid, but are NEVER labeled as "0%" — the label
// shows "ไม่มีข้อมูล" instead, so a missing axis never reads as a
// confirmed zero score (PROJECT_CONTEXT.md §25's "never fabricate/imply
// evidence that isn't there").
//
// `size` scales the whole chart proportionally — the Dashboard's compact
// card and the full /aptitude-analysis page share this one component,
// just at different sizes, rather than duplicating the SVG geometry.
export function PloRadarChart({
  radar,
  size = DEFAULT_SIZE,
  title = 'Radar ความสำเร็จตาม PLO',
  threshold,
  footer,
  selectedPloId,
  onSelectPlo,
  formatValue,
  labelClassName = 'fill-primary text-[11px] font-medium',
}: {
  radar: RadarPoint[];
  size?: number;
  title?: string;
  // Optional — draws a dashed reference ring at this level so it's
  // visually obvious which axes clear the curriculum's pass bar, tying
  // this chart to the same threshold concept /clo-plo-analysis uses.
  // Omitted entirely on the Dashboard's compact card (not worth the
  // visual noise at that size).
  threshold?: number;
  footer?: ReactNode;
  // Both optional and unused by the two student callers (/aptitude-analysis,
  // Dashboard's PloRadarCard) — instructor's PloCoverageCard is the only
  // caller that passes them, to let a point's own hit-circle double as a
  // click target alongside its pill-row selector.
  selectedPloId?: string | null;
  onSelectPlo?: (ploId: string) => void;
  // How a PLO value is written in the labels and tooltips. Omitted on the student pages, which
  // use the one-decimal five-point scale (two decimals for an axis just under the threshold).
  formatValue?: (percent: number | null, noDataLabel?: string) => string;
  labelClassName?: string;
}) {
  const total = radar.length;
  const valueText = (plo: RadarPoint) =>
    formatValue
      ? formatValue(plo.value, 'ไม่มีข้อมูล')
      : formatFiveScaleAgainstThreshold(
          plo.value,
          threshold ?? null,
          plo.value !== null && threshold != null && plo.value >= threshold,
          'ไม่มีข้อมูล',
        );
  const center = size / 2;
  const maxRadius = size * (110 / DEFAULT_SIZE);
  const labelRadius = size * (140 / DEFAULT_SIZE);

  function pointOnAxis(index: number, radius: number) {
    const angle = -90 + (360 / total) * index;
    const rad = (angle * Math.PI) / 180;
    return { x: center + radius * Math.cos(rad), y: center + radius * Math.sin(rad) };
  }

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState illustration="no-outcomes" description="ยังไม่มีข้อมูล PLO สำหรับหลักสูตรนี้" />
        </CardContent>
      </Card>
    );
  }

  const thresholdRingPoints =
    threshold != null
      ? Array.from({ length: total }, (_, i) =>
          pointOnAxis(i, maxRadius * (Math.max(0, Math.min(100, threshold)) / 100)),
        )
          .map((p) => `${p.x},${p.y}`)
          .join(' ')
      : null;

  const dataPoints = radar.map((plo, i) =>
    pointOnAxis(i, maxRadius * (plo.value !== null ? Math.max(0, Math.min(100, plo.value)) / 100 : 0)),
  );
  const polygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle>{title}</CardTitle>
        <GradeEstimateBadge />
      </CardHeader>
      <CardContent className="flex justify-center">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="h-auto max-w-full"
        >
          {/* Background rings */}
          {RING_FRACTIONS.map((fraction) => {
            const ringPoints = Array.from({ length: total }, (_, i) =>
              pointOnAxis(i, maxRadius * fraction),
            )
              .map((p) => `${p.x},${p.y}`)
              .join(' ');
            return (
              <polygon
                key={fraction}
                points={ringPoints}
                className="fill-none stroke-border"
                strokeWidth={1}
              />
            );
          })}

          {/* Threshold reference ring — dashed so it reads as "the bar to
              clear" rather than another data ring. */}
          {thresholdRingPoints && (
            <polygon
              points={thresholdRingPoints}
              className="fill-none stroke-amber-400"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          )}

          {/* Axis lines */}
          {radar.map((_, i) => {
            const outer = pointOnAxis(i, maxRadius);
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={outer.x}
                y2={outer.y}
                className="stroke-border"
                strokeWidth={1}
              />
            );
          })}

          {/* Data polygon — fillOpacity as a direct SVG attribute rather than
              a Tailwind opacity modifier (fill-brand/20), since `brand` is
              defined as a full `hsl(var(--brand))` string in tailwind.config
              rather than the <alpha-value> placeholder pattern Tailwind's
              color-opacity utilities require to work. */}
          <polygon
            points={polygonPoints}
            className="animate-radar-shape fill-brand stroke-brand motion-reduce:animate-none"
            fillOpacity={0.2}
            strokeWidth={2}
            pathLength={1}
            strokeDasharray={1}
          />
          {dataPoints.map((p, i) => (
            <Tooltip key={radar[i].ploId}>
              <TooltipTrigger asChild>
                {/* Transparent oversized circle as the hover hit-target —
                    the visible r=3 dot below stays the same size as before. */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={9}
                  fill="transparent"
                  onClick={() => onSelectPlo?.(radar[i].ploId)}
                  className={onSelectPlo ? 'cursor-pointer' : undefined}
                />
              </TooltipTrigger>
              <TooltipContent>
                {radar[i].code}: {valueText(radar[i])}
              </TooltipContent>
            </Tooltip>
          ))}
          {dataPoints.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={3}
              className="pointer-events-none animate-radar-dot fill-brand motion-reduce:animate-none"
            />
          ))}
          {selectedPloId != null &&
            dataPoints.map(
              (p, i) =>
                radar[i].ploId === selectedPloId && (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={6}
                    aria-hidden="true"
                    className="pointer-events-none fill-none stroke-brand"
                    strokeWidth={2}
                  />
                ),
            )}

          {/* Labels */}
          {radar.map((plo, i) => {
            const labelPos = pointOnAxis(i, labelRadius);
            return (
              <text
                key={plo.ploId}
                x={labelPos.x}
                y={labelPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className={labelClassName}
              >
                <tspan x={labelPos.x} dy="-0.3em">
                  {plo.code}
                </tspan>
                <tspan x={labelPos.x} dy="1.2em">
                  {valueText(plo)}
                </tspan>
              </text>
            );
          })}
        </svg>
      </CardContent>
      {footer && <CardContent>{footer}</CardContent>}
    </Card>
  );
}
