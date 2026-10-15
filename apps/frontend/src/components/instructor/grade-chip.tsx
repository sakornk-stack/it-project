import type { Grade } from '@eduanalyze-ai/shared-types';
import { gradeBadgeTone } from '@/lib/grade-badge-color';
import { GRADE_LABELS } from '@/lib/grade-label';
import { Badge } from '@/components/ui/badge';

// The one grade chip of the instructor pages, toned by the shared grade colours
// (F/U danger, C+ to D warning). The word "เกรด" is left to the reader's context.
export function GradeChip({ grade }: Readonly<{ grade: Grade }>) {
  return (
    <Badge tone={gradeBadgeTone(grade)} className="min-w-9 justify-center px-2.5 tabular-nums">
      <span className="sr-only">เกรด </span>
      {GRADE_LABELS[grade]}
    </Badge>
  );
}
