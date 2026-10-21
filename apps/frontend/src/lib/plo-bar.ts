import { percentToFiveScale } from '@/lib/five-scale';

// What a PLO bar says about itself, decided once so every bar (student dashboard,
// ADMIN curriculum page) reads the same. Same rule as ploProgressBarColorClassName:
// at the bar or above passes, anything under it is "not yet", never a failure.
export type PloBarStatus = 'no-data' | 'unjudged' | 'passed' | 'below';

export function ploBarStatus(value: number | null, threshold: number | null): PloBarStatus {
  if (value === null) return 'no-data';
  if (threshold === null) return 'unjudged';
  return value >= threshold ? 'passed' : 'below';
}

// Where the pass-mark tick sits, as a percentage of the bar's width. Always the
// curriculum's own value (never a fixed 3.5), clamped so a bad value can't push
// the tick off the bar; null = no bar known, so no tick.
export function ploTickPercent(threshold: number | null): number | null {
  if (threshold === null || !Number.isFinite(threshold)) return null;
  return Math.max(0, Math.min(100, threshold));
}

const STATUS_WORD: Record<PloBarStatus, string> = {
  'no-data': 'ไม่มีข้อมูล',
  unjudged: '',
  passed: 'ผ่านเกณฑ์',
  below: 'ยังไม่ผ่านเกณฑ์',
};

// The bar's accessible name. The tick is aria-hidden and the colour means nothing
// to a screen reader, so the verdict and the pass mark are spelled out here.
export function ploBarAriaLabel(
  code: string,
  name: string,
  value: number | null,
  threshold: number | null,
): string {
  const status = STATUS_WORD[ploBarStatus(value, threshold)];
  const mark =
    threshold === null ? '' : `เกณฑ์ผ่าน ≥ ${percentToFiveScale(threshold).toFixed(1)} / 5.0`;
  const detail = [status, mark].filter(Boolean).join(' ');
  return detail ? `${code} ${name} — ${detail}` : `${code} ${name}`;
}
