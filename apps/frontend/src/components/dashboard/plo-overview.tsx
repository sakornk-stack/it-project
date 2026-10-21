'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { RadarPoint } from '@eduanalyze-ai/shared-types';
import { cn } from '@/lib/utils';
import { formatFiveScaleAgainstThreshold } from '@/lib/five-scale';
import { ploStatusTone } from '@/lib/plo-color';
import { PloRadarChart } from '@/components/aptitude-analysis/plo-radar-chart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PloProgressTable } from './plo-progress-table';

type FormatScore = (percent: number | null, noDataLabel?: string) => string;

function Highlight({
  label,
  plo,
  formatScore,
}: Readonly<{ label: string; plo: RadarPoint | undefined; formatScore: FormatScore }>) {
  if (!plo || plo.value === null) return null;
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-start justify-between gap-3 text-sm">
        <span className="min-w-0 break-words font-medium text-primary">
          {plo.code} <span className="font-normal text-muted-foreground">{plo.name}</span>
        </span>
        <span className="shrink-0 whitespace-nowrap text-right font-semibold tabular-nums text-primary">
          {formatScore(plo.value)}
          <span className="font-normal text-muted-foreground"> / 5.0</span>
        </span>
      </p>
    </div>
  );
}

export function RadarLegend() {
  return (
    <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
      <li className="flex items-center gap-2">
        <svg width="24" height="8" aria-hidden="true">
          <line x1="0" y1="4" x2="24" y2="4" className="stroke-brand" strokeWidth={2} />
        </svg>
        คะแนนของนิสิต
      </li>
      <li className="flex items-center gap-2">
        <svg width="24" height="8" aria-hidden="true">
          <line
            x1="0"
            y1="4"
            x2="24"
            y2="4"
            className="stroke-amber-400"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
        </svg>
        เกณฑ์ผ่าน
      </li>
    </ul>
  );
}

export function PloOverview({
  radar,
  strengths,
  areasForImprovement,
  threshold,
}: Readonly<{
  radar: RadarPoint[];
  strengths: RadarPoint[];
  areasForImprovement: RadarPoint[];
  // Pass threshold (0-100) from the curriculum; null = unknown, so no pass/fail is shown.
  threshold: number | null;
}>) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  // Same rule as the radar labels and /clo-plo-analysis: a score just under the bar never
  // rounds up to read as the threshold.
  const formatScore: FormatScore = (percent, noDataLabel) =>
    formatFiveScaleAgainstThreshold(
      percent,
      threshold,
      percent !== null && threshold !== null && percent >= threshold,
      noDataLabel,
    );
  const passedCount =
    threshold === null
      ? null
      : radar.filter((p) => p.value !== null && p.value >= threshold).length;
  const best = strengths[0];
  const weakest = areasForImprovement[0];
  const hasHighlights = (best?.value ?? null) !== null || (weakest?.value ?? null) !== null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        {/* Stretch the chart card to the right card's height and centre the radar in the space. */}
        <div className="[&>*>*:nth-child(2)>svg]:origin-center [&>*>*:nth-child(2)>svg]:animate-radar-grow motion-reduce:[&>*>*:nth-child(2)>svg]:animate-none [&>*:nth-child(1)]:h-full [&>*]:flex [&>*]:flex-col [&>*>*:nth-child(2)]:flex-1 [&>*>*:nth-child(2)]:items-center">
          <PloRadarChart
            radar={radar}
            size={380}
            title="คะแนนเฉลี่ยราย PLO (เต็ม 5)"
            threshold={threshold ?? undefined}
            labelClassName="fill-primary text-[13px] font-medium"
            footer={threshold !== null ? <RadarLegend /> : undefined}
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>ภาพรวมราย PLO</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {passedCount !== null && (
              <p className="text-sm font-medium text-primary">
                ผ่านเกณฑ์ {passedCount} จาก {radar.filter((p) => p.value !== null).length} PLO ที่มีข้อมูล
              </p>
            )}
            {hasHighlights && (
              <div className="grid grid-cols-1 gap-3">
                <Highlight label="PLO ที่ดีที่สุด" plo={best} formatScore={formatScore} />
                <Highlight
                  label="PLO ที่ควรพัฒนามากที่สุด"
                  plo={weakest}
                  formatScore={formatScore}
                />
              </div>
            )}
            <ul className="divide-y divide-border">
              {radar.map((plo) => (
                <li key={plo.ploId} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 break-words">
                    <span className="font-medium text-primary">{plo.code}</span>{' '}
                    <span className="text-muted-foreground">{plo.name}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-medium tabular-nums text-primary">
                      {formatScore(plo.value, 'ไม่มีข้อมูล')}
                    </span>
                    {threshold !== null && plo.value !== null && (
                      <Badge tone={ploStatusTone(plo.value, threshold)}>
                        {plo.value >= threshold ? 'ผ่าน' : 'ยังไม่ผ่าน'}
                      </Badge>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setShowTable((v) => !v)}
        aria-expanded={showTable}
        aria-controls={tableId}
        className="min-h-11 w-full justify-center gap-1.5"
      >
        {showTable ? 'ซ่อนตาราง' : `ดูเป็นตาราง (${radar.length} PLO)`}
        <ChevronDown size={14} className={cn('transition-transform', showTable && 'rotate-180')} />
      </Button>
      {showTable && (
        <Card id={tableId}>
          <CardHeader>
            <CardTitle>รายละเอียดคะแนนราย PLO</CardTitle>
          </CardHeader>
          <CardContent>
            <PloProgressTable radar={radar} formatValue={formatScore} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
