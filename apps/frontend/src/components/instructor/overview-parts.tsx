import { AlertTriangle, CheckCircle2, CircleDashed, CircleMinus, type LucideIcon } from 'lucide-react';
import { STATUS_META, type OverviewStatus } from '@/lib/instructor-overview';
import { fewStudentsLabel } from '@/lib/course-snapshot';
import { formatPercent } from '@/lib/format-percent';
import { BAR_TONE_CLASSES } from '@/lib/tone';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const STATUS_ICON: Record<OverviewStatus, LucideIcon> = {
  met: CheckCircle2,
  near: CircleMinus,
  below: AlertTriangle,
  none: CircleDashed,
};

// Status as an icon plus words, so colour is never the only signal.
export function StatusBadge({
  status,
  className,
  label: labelOverride,
}: Readonly<{ status: OverviewStatus; className?: string; label?: string }>) {
  const { label: defaultLabel, tone } = STATUS_META[status];
  const label = labelOverride ?? defaultLabel;
  const Icon = STATUS_ICON[status];
  return (
    <Badge tone={tone} className={cn('gap-1 px-2.5 py-1 text-sm', className)}>
      <Icon size={14} aria-hidden="true" />
      {label}
    </Badge>
  );
}

// Light on purpose: a grey tag, not a warning.
export function LowSampleTag({ counted }: Readonly<{ counted: number }>) {
  return (
    <span
      className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
      title={`มีนิสิตที่ได้เกรดเพียง ${counted} คน ตัวเลขเปอร์เซ็นต์จึงเปลี่ยนมากเมื่อเพิ่มหรือลดหนึ่งคน`}
    >
      {fewStudentsLabel(counted)}
    </span>
  );
}

// The share at B or above as a bar with the goal marked on it.
export function GoalBar({
  percent,
  target,
  status,
  className,
}: Readonly<{ percent: number | null; target: number | null; status: OverviewStatus; className?: string }>) {
  const width = percent === null ? 0 : Math.min(100, Math.max(0, percent));
  const mark = target === null ? null : Math.min(100, Math.max(0, target));
  const goal = target === null ? '' : ` เกณฑ์ ${formatPercent(target)} ${STATUS_META[status].label}`;
  const label = percent === null ? 'ยังไม่มีเกรด' : `ได้ B ขึ้นไป ${formatPercent(percent)}${goal}`;
  return (
    <div
      role="img"
      aria-label={label}
      className={cn('relative h-3 rounded-full bg-slate-100', className)}
    >
      <span
        className={cn('absolute inset-y-0 left-0 rounded-full', BAR_TONE_CLASSES[STATUS_META[status].tone])}
        style={{ width: `${width}%` }}
      />
      {mark !== null && (
        <span className="absolute -inset-y-1 w-0.5 rounded bg-primary" style={{ left: `calc(${mark}% - 1px)` }} />
      )}
    </div>
  );
}
