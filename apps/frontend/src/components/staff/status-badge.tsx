import { AlertTriangle, Ban, CheckCircle2, Eye, MinusCircle } from 'lucide-react';
import { RISK_LEVEL_LABELS } from '@/lib/risk-level';
import { BADGE_TONE_CLASSES, type SemanticTone } from '@/lib/tone';
import { cn } from '@/lib/utils';
import { SUSPENDED_LABEL, type StaffStatusKey } from './staff-status';
import { NO_DATA_LABEL } from './student-reading';

const STATUS_VIEW: Record<
  StaffStatusKey,
  { label: string; tone: SemanticTone; Icon: typeof Eye; className?: string }
> = {
  CRITICAL: { label: RISK_LEVEL_LABELS.CRITICAL, tone: 'danger', Icon: AlertTriangle },
  WATCH: { label: RISK_LEVEL_LABELS.WATCH, tone: 'warning', Icon: Eye },
  NORMAL: { label: RISK_LEVEL_LABELS.NORMAL, tone: 'success', Icon: CheckCircle2 },
  // Grey, never green or red: an absent reading is not a good or a bad one.
  NO_DATA: { label: NO_DATA_LABEL, tone: 'neutral', Icon: MinusCircle },
  SUSPENDED: { label: SUSPENDED_LABEL, tone: 'neutral', Icon: Ban, className: 'border-dashed' },
};

export function statusLabel(status: StaffStatusKey) {
  return STATUS_VIEW[status].label;
}

export function statusIcon(status: StaffStatusKey) {
  return STATUS_VIEW[status].Icon;
}

// Icon + words on every badge, so the status never rests on colour alone.
export function StatusBadge({
  status,
  className,
}: Readonly<{ status: StaffStatusKey; className?: string }>) {
  const { label, tone, Icon, className: own } = STATUS_VIEW[status];
  return (
    <span
      className={cn(
        'inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-semibold',
        BADGE_TONE_CLASSES[tone],
        own,
        className,
      )}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {label}
    </span>
  );
}
