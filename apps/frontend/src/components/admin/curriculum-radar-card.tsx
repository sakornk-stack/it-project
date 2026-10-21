'use client';

import type { RadarPoint } from '@eduanalyze-ai/shared-types';
import { formatFiveScaleAgainstThreshold, percentToFiveScale } from '@/lib/five-scale';
import { PloRadarChart } from '@/components/aptitude-analysis/plo-radar-chart';
import { RadarLegend } from '@/components/dashboard/plo-overview';
import { PloProgressTable } from '@/components/dashboard/plo-progress-table';

// The curriculum's PLO averages against its pass bar: a dashed ring on the radar and, per
// PLO, the same bar the student dashboard uses (PloProgressTable: pass-mark tick at the
// curriculum's own bar, "ผ่าน / ยังไม่ผ่าน" word, aria-label), so the verdict never rests on
// colour. With no bar known (threshold null) the chart still draws and the pass words and
// ticks are left out.
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
          <PloProgressTable
            radar={radar}
            formatValue={formatScore}
            threshold={threshold}
            showStatusBadge
          />
        </div>
      }
    />
  );
}
