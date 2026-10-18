import { Badge } from '@/components/ui/badge';
import { GRADE_ESTIMATE_HINT, GRADE_ESTIMATE_LABEL } from '@/lib/grade-estimate';

// Marks a CLO/PLO figure as derived from grades. Neutral tone on purpose: it is a
// caption on the number, not a status, so it must not compete with pass/fail chips.
// The hint is `sr-only` (and `title` for pointer users) so the visible label stays short.
export function GradeEstimateBadge({ className }: Readonly<{ className?: string }>) {
  return (
    <Badge tone="neutral" className={className}>
      <span title={GRADE_ESTIMATE_HINT}>{GRADE_ESTIMATE_LABEL}</span>
      <span className="sr-only"> ({GRADE_ESTIMATE_HINT})</span>
    </Badge>
  );
}
