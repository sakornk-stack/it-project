// Count-up for the figure cards of the non-student roles. Plays once, short,
// and only for a real number: a missing value is shown as its fallback text
// and never counted.
export const COUNT_UP_MS = 700;

export function isCountable(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export interface NumberText {
  // The real value, as the page would have printed it without any animation.
  final: string;
  // What is on screen right now (equals `final` once the count has ended).
  shown: string;
}

export function numberText(
  value: number | null | undefined,
  current: number,
  format: (n: number) => string,
  fallback: string,
): NumberText {
  if (!isCountable(value)) return { final: fallback, shown: fallback };
  return { final: format(value), shown: format(current) };
}
