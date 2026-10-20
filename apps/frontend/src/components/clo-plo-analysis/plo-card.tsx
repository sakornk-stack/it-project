'use client';

import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import type { StudentPloRadarPoint } from '@eduanalyze-ai/shared-types';
import { cn } from '@/lib/utils';
import { ploProgressBarColorClassName, ploStatusTone } from '@/lib/plo-color';
import {
  formatFiveScale,
  formatFiveScaleAgainstThreshold,
  percentToFiveScale,
} from '@/lib/five-scale';
import {
  INSTRUCTOR_ASSESSED_COURSE_CODES,
  INSTRUCTOR_ASSESSED_NOTE,
  ploCoverage,
} from '@/lib/plo-notes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export function PloCard({
  plo,
  description,
  isAchieved,
  threshold,
  expanded,
  onExpandedChange,
}: {
  plo: StudentPloRadarPoint;
  description: string | null;
  isAchieved: boolean;
  threshold: number | null;
  // Controlled by the page, which is the single owner of which cards are open (it also
  // switches the grid out of stretch mode while any card is open).
  expanded: boolean;
  onExpandedChange: (ploId: string, expanded: boolean) => void;
}) {
  const hasValue = plo.value !== null;
  const isExpanded = expanded;
  const hasBreakdown = plo.cloBreakdown.length > 0;
  const breakdownId = useId();
  const coverage = ploCoverage(plo);

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-4 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <span className="inline-flex rounded-md border bg-muted px-2 py-0.5 text-xs font-semibold text-primary">
              {plo.code}
            </span>
            <h3 className="break-words text-base font-semibold leading-snug text-primary">
              {plo.name}
            </h3>
          </div>
          <Badge tone={ploStatusTone(plo.value, threshold)}>
            {!hasValue ? 'ไม่มีข้อมูล' : isAchieved ? 'ผ่านเกณฑ์' : 'ยังไม่ผ่านเกณฑ์'}
          </Badge>
        </div>

        {description && (
          <p className="line-clamp-2 text-sm leading-5 text-muted-foreground" title={description}>
            {description}
          </p>
        )}

        <div className="mt-auto space-y-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tabular-nums text-primary">
              {formatFiveScaleAgainstThreshold(plo.value, threshold, isAchieved)}
            </span>
            {hasValue && <span className="text-xs text-muted-foreground">/ 5.0</span>}
            <span className="ml-auto text-xs text-muted-foreground">ความสำเร็จ</span>
          </div>
          <div className="relative pt-1">
            <Progress
              value={plo.value ?? 0}
              className="h-1.5 w-full"
              barClassName={ploProgressBarColorClassName(plo.value, threshold)}
            />
            {threshold !== null && (
              <span
                aria-hidden="true"
                className="absolute top-0 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-primary"
                style={{ left: `${Math.max(0, Math.min(100, threshold))}%` }}
              />
            )}
          </div>
          {coverage.total > 0 && (
            <p className="text-xs text-muted-foreground">
              คำนวณจาก {coverage.used} จาก {coverage.total} วิชา
            </p>
          )}
          {threshold !== null && (
            <p className="text-xs text-muted-foreground">
              เกณฑ์ผ่าน ≥ {percentToFiveScale(threshold).toFixed(1)} / 5.0
            </p>
          )}
        </div>

        {hasBreakdown && (
          <Button
            type="button"
            onClick={() => onExpandedChange(plo.ploId, !isExpanded)}
            aria-expanded={isExpanded}
            aria-controls={breakdownId}
            variant="outline"
            size="sm"
            className="min-h-11 w-full justify-center gap-1.5 text-muted-foreground hover:text-foreground"
          >
            {isExpanded ? 'ซ่อนรายวิชาและ CLO' : `ดูรายวิชาและ CLO (${plo.cloBreakdown.length})`}
            <ChevronDown
              size={14}
              aria-hidden="true"
              className={cn(
                'transition-transform motion-reduce:transition-none',
                isExpanded && 'rotate-180',
              )}
            />
          </Button>
        )}

        {isExpanded && hasBreakdown && (
          <div id={breakdownId} className="space-y-2 border-t border-slate-100 pt-3">
            {plo.cloBreakdown.map((clo) => (
              <div
                key={clo.cloId}
                className="flex items-start justify-between gap-3 rounded-md bg-slate-50 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {clo.code} · {clo.courseCode} {clo.courseName}
                  </p>
                  <p className="text-sm text-primary">{clo.description}</p>
                  {INSTRUCTOR_ASSESSED_COURSE_CODES.has(clo.courseCode) && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {INSTRUCTOR_ASSESSED_NOTE}
                    </p>
                  )}
                </div>
                <Badge
                  tone={clo.score === null ? 'neutral' : clo.isAchieved ? 'success' : 'warning'}
                >
                  {formatFiveScale(clo.score, 'ไม่มีข้อมูล')}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
