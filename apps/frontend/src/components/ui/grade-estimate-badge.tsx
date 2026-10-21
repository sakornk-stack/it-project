import { Badge } from '@/components/ui/badge';
import { GRADE_ESTIMATE_HINT, GRADE_ESTIMATE_LABEL } from '@/lib/grade-estimate';

// Marks a CLO/PLO figure as derived from grades. Neutral tone on purpose: it is a
// caption on the number, not a status, so it must not compete with pass/fail chips.
// The hint is `sr-only` (and `title` for pointer users) so the visible label stays short.
// `label` lets the instructor pages use their own wording (GRADE_BASIS_LABEL); every
// other page keeps the default.
export function GradeEstimateBadge({
  className,
  label = GRADE_ESTIMATE_LABEL,
}: Readonly<{ className?: string; label?: string }>) {
  return (
    <Badge tone="neutral" className={className}>
      <span title={GRADE_ESTIMATE_HINT}>{label}</span>
      <span className="sr-only"> ({GRADE_ESTIMATE_HINT})</span>
    </Badge>
  );
}
