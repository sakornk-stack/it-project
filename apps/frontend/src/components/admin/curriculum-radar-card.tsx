'use client';

import type { RadarPoint } from '@eduanalyze-ai/shared-types';
import { formatFiveScaleAgainstThreshold, percentToFiveScale } from '@/lib/five-scale';
import { ploProgressBarColorClassName, ploStatusTone } from '@/lib/plo-color';
import { PloRadarChart } from '@/components/aptitude-analysis/plo-radar-chart';
import { RadarLegend } from '@/components/dashboard/plo-overview';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

// The curriculum's PLO averages against its pass bar: a dashed ring on the radar and, per
// PLO, a bar plus a "ผ่าน / ยังไม่ผ่าน" word, so the verdict never rests on colour. With no
// bar known (threshold null) the chart still draws and the pass words are left out.
export function CurriculumRadarCard({
  radar,
  threshold,
}: Readonly<{ radar: RadarPoint[]; threshold: number | null }>) {
  const formatScore = (percent: number | null, noDataLabel?: string) =>
    formatFiveScaleAgainstThreshold(
      percent,
      threshold,
      percent !== null && threshold !== null && percent >= threshold,
      noDataLabel,
    );
  const passed =
    threshold === null
      ? null
      : radar.filter((p) => p.value !== null && p.value >= threshold).length;

  return (
    <PloRadarChart
      radar={radar}
      size={440}
      title="คะแนนเฉลี่ยราย PLO (เต็ม 5)"
      threshold={threshold ?? undefined}
      formatValue={formatScore}
      labelClassName="fill-primary text-[13px] font-medium"
      footer={
        <div className="space-y-4 border-t pt-4">
          {threshold !== null && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-primary">
                ผ่านเกณฑ์ {passed} จาก {radar.length} PLO
              </p>
              <RadarLegend />
            </div>
          )}
          {threshold !== null && (
            <p className="text-xs text-muted-foreground">
              เกณฑ์ผ่านของหลักสูตร {threshold}% (คะแนน {percentToFiveScale(threshold).toFixed(1)}{' '}
              จาก 5)
            </p>
          )}
          <ul className="space-y-3">
            {radar.map((plo) => (
              <li key={plo.ploId} className="space-y-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
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
                </div>
                <Progress
                  value={plo.value ?? 0}
                  label={`${plo.code} ${plo.name}`}
                  barClassName={ploProgressBarColorClassName(plo.value, threshold)}
                />
              </li>
            ))}
          </ul>
        </div>
      }
    />
  );
}
