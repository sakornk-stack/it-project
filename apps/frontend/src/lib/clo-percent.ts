// A course-level CLO percent ("share of students graded B or above") is null
// when nobody has a final grade yet. That is "no data", not a low score, so it
// must never be drawn or worded as 0%.
export const NO_CLO_DATA_LABEL = 'ไม่มีข้อมูล';
export const NO_CLO_DATA_HINT = 'ยังไม่มีผลการประเมินที่เชื่อมกับ CLO นี้';

export function hasCloPercent(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

// Whole-number percent, or "ไม่มีข้อมูล" when there is nothing to show.
export function formatCloPercent(value: number | null | undefined): string {
  return hasCloPercent(value) ? `${Math.round(value)}%` : NO_CLO_DATA_LABEL;
}

// Bar fill: no data is an empty bar (the caller also styles it muted).
export function cloBarValue(value: number | null | undefined): number {
  return hasCloPercent(value) ? Math.max(0, Math.min(100, value)) : 0;
}
