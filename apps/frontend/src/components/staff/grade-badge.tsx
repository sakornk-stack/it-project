import { AlertTriangle, MinusCircle, XCircle, type LucideIcon } from 'lucide-react';
import type { Grade } from '@eduanalyze-ai/shared-types';
import { GRADE_LABELS } from '@/lib/grade-label';
import { BADGE_TONE_CLASSES, type SemanticTone } from '@/lib/tone';
import { cn } from '@/lib/utils';

// Grades that need a second look carry a tone, an icon and a word, so none of
// them rests on colour alone. Every other grade stays plain text.
const FLAGGED: Partial<Record<Grade, { tone: SemanticTone; Icon: LucideIcon; note: string }>> = {
  F: { tone: 'danger', Icon: XCircle, note: 'ไม่ผ่าน' },
  U: { tone: 'danger', Icon: XCircle, note: 'ไม่ผ่าน' },
  D_PLUS: { tone: 'warning', Icon: AlertTriangle, note: 'เกรดต่ำ' },
  D: { tone: 'warning', Icon: AlertTriangle, note: 'เกรดต่ำ' },
  W: { tone: 'neutral', Icon: MinusCircle, note: 'ถอน' },
  I: { tone: 'neutral', Icon: MinusCircle, note: 'ไม่สมบูรณ์' },
};

export function GradeBadge({ grade }: Readonly<{ grade: Grade }>) {
  const flagged = FLAGGED[grade];
  if (!flagged) return <span className="font-semibold tabular-nums">{GRADE_LABELS[grade]}</span>;
  const { tone, Icon, note } = flagged;
  return (
    <span
      className={cn(
        'inline-flex min-h-7 items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-semibold',
        BADGE_TONE_CLASSES[tone],
      )}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span className="tabular-nums">{GRADE_LABELS[grade]}</span>
      <span className="font-medium">· {note}</span>
    </span>
  );
}
