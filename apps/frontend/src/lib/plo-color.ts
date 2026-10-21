import { BAR_TONE_CLASSES, type SemanticTone } from '@/lib/tone';
// Same pattern as gpa-color.ts: color decided from the target value only,
// never a mid-animation number, so it doesn't flicker between bands.
// Threshold-relative (not fixed bands like GPA) since PLO achievement is a
// percent measured against the curriculum's own pass threshold.
export function ploProgressBarColorClassName(
  value: number | null,
  threshold: number | null,
): string {
  if (value === null) return BAR_TONE_CLASSES.neutral;
  if (threshold === null) return 'bg-primary';
  if (value >= threshold) return 'bg-emerald-600';
  // Under the bar is always the soft warning tone, never red: not passing yet is a to-do.
  return BAR_TONE_CLASSES.warning;
}

// Tone for the status badge. The bar's colour is the single source of the
// green / amber rule; this only translates
// that class into a tone, so the badge and the bar can never disagree.
const BAR_CLASS_TONE: Record<string, SemanticTone> = {
  'bg-emerald-600': 'success',
  [BAR_TONE_CLASSES.warning]: 'warning',
};

export function ploStatusTone(value: number | null, threshold: number | null): SemanticTone {
  return BAR_CLASS_TONE[ploProgressBarColorClassName(value, threshold)] ?? 'neutral';
}
