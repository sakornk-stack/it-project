import { ChevronDown, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { gpaColorClassName } from '@/lib/gpa-color';
import { cn } from '@/lib/utils';
import { TEXT_TONE_CLASSES } from '@/lib/tone';

// Separate component (not inlined in RecordTimeline's .map()) — kept as
// its own unit for the per-semester trend/color logic below.
export function SemesterGroupHeader({
  label,
  gpa,
  previousGpa,
  creditsCounted,
  isExpanded,
  onToggle,
}: {
  label: string;
  gpa: number | null;
  // Nearest earlier semester with a real (non-null) GPA — null if this is
  // the first semester with data, or if there's nothing earlier to
  // compare against. See record-timeline.tsx for how this is resolved.
  previousGpa: number | null;
  creditsCounted: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  // Trend arrow — a different color axis from gpaColorClassName's
  // absolute-level bands: this one is about direction of change versus
  // the last term with real data, not the number's own magnitude.
  const showTrend = gpa != null && previousGpa != null;
  const trend = showTrend
    ? gpa! > previousGpa!
      ? 'up'
      : gpa! < previousGpa!
        ? 'down'
        : 'same'
    : null;
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendLabel = trend === 'up' ? 'สูงขึ้น' : trend === 'down' ? 'ลดลง' : 'เท่าเดิม';
  const trendColorClassName =
    trend === 'up' ? TEXT_TONE_CLASSES.success : trend === 'down' ? 'text-destructive' : 'text-muted-foreground';

  return (
    <button
      type="button"
      onClick={onToggle}
      className="mb-3 flex min-h-11 w-full flex-wrap items-center gap-x-4 gap-y-1 text-left"
    >
      <span className="flex items-center gap-2">
        <ChevronDown
          size={16}
          className={cn('text-muted-foreground transition-transform', isExpanded ? 'rotate-0' : '-rotate-90')}
        />
        <h3 className="font-semibold text-primary">{label}</h3>
      </span>
      {gpa != null && (
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 border-l border-border pl-4 text-xs text-muted-foreground">
          เกรดเฉลี่ยเทอมนี้{' '}
          <span className={cn('font-semibold', gpaColorClassName(gpa))}>{gpa.toFixed(2)}</span>
          {showTrend && (
            <span className={cn('flex items-center gap-1', trendColorClassName)}>
              <TrendIcon size={14} aria-hidden="true" />
              {trendLabel}
            </span>
          )}
          <span>({creditsCounted} หน่วยกิต)</span>
        </span>
      )}
    </button>
  );
}
