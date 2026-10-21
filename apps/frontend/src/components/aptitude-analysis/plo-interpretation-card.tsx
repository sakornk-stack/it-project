import { ClipboardList, Info, Lightbulb, TrendingDown, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { NO_DATA_SUMMARY, type PloInterpretation } from '@/lib/interpret-plo-radar';
import { TEXT_TONE_CLASSES } from '@/lib/tone';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Icon+color row per item, replacing the old plain <ul><li> list — same
// achieved/needs-improvement/neutral color language as plo-card.tsx's
// badges (emerald/amber), so this page and /clo-plo-analysis read as one
// system.
function IconList({
  title,
  items,
  icon: Icon,
  tone,
}: {
  title: string;
  items: string[];
  icon: LucideIcon;
  tone: 'strength' | 'weakness' | 'neutral' | 'muted';
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-primary">{title}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
            <Icon
              size={15}
              className={cn(
                'mt-0.5 shrink-0',
                tone === 'strength' && TEXT_TONE_CLASSES.success,
                tone === 'weakness' && TEXT_TONE_CLASSES.warning,
                tone === 'neutral' && 'text-primary',
                tone === 'muted' && 'text-muted-foreground',
              )}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Rule-based, deterministic text derived from the real PLO numbers
// (interpret-plo-radar.ts) — no AI call, no cost. Named/headed to reflect
// that honestly, not "AI" (same principle already applied to
// credit-checker-panel.tsx's copy for its own deterministic output).
export function PloInterpretationCard({ report }: { report: PloInterpretation }) {
  const hasNoData = report.summary === NO_DATA_SUMMARY;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList size={16} className="text-brand" />
          สรุปผลการประเมิน
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasNoData ? (
          <EmptyState icon={Info} title="ยังไม่มีข้อมูลให้สรุป" description={report.summary} />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{report.summary}</p>
            <IconList title="จุดแข็ง" items={report.strengths} icon={TrendingUp} tone="strength" />
            <IconList title="จุดที่ควรพัฒนา" items={report.weaknesses} icon={TrendingDown} tone="weakness" />
            <IconList title="คำแนะนำ" items={report.recommendations} icon={Lightbulb} tone="neutral" />
            <IconList title="ยังไม่มีข้อมูล" items={report.noData} icon={Info} tone="muted" />
          </>
        )}
      </CardContent>
    </Card>
  );
}
