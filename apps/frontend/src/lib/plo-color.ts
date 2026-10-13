import type { SemanticTone } from '@/lib/tone';
// Same pattern as gpa-color.ts: color decided from the target value only,
// never a mid-animation number, so it doesn't flicker between bands.
// Threshold-relative (not fixed bands like GPA) since PLO achievement is a
// percent measured against the curriculum's own pass threshold.
export function ploProgressBarColorClassName(
  value: number | null,
  threshold: number | null,
): string {
  if (value === null) return 'bg-slate-300';
  if (threshold === null) return 'bg-primary';
  if (value >= threshold) return 'bg-emerald-600';
  if (value >= threshold - 15) return 'bg-amber-500';
  return 'bg-destructive';
}

// Tone for the status badge. The bar's colour is the single source of the
// emerald / amber / red rule (and of its 15-point margin); this only translates
// that class into a tone, so the badge and the bar can never disagree.
const BAR_CLASS_TONE: Record<string, SemanticTone> = {
  'bg-emerald-600': 'success',
  'bg-amber-500': 'warning',
  'bg-destructive': 'danger',
};

export function ploStatusTone(value: number | null, threshold: number | null): SemanticTone {
  return BAR_CLASS_TONE[ploProgressBarColorClassName(value, threshold)] ?? 'neutral';
}
