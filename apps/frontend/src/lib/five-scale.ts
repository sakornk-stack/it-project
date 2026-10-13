// Backend/DB keeps computing and storing CLO/PLO achievement as a 0-100
// percent everywhere (StudentPloRadarPoint.value, CloAchievementEntry,
// CourseCloAchievementReport, thresholds, etc.) — this is a display-layer
// conversion only, used by every component that renders one of those
// percent values to the user. Rounded to 1 decimal place to match the
// existing self-assessment score format already shown alongside these
// (e.g. clo-achievement-section.tsx's "คะแนนประเมินตนเองเฉลี่ยต่อ CLO
// (1-5)" uses averageScore.toFixed(1)) — internal logic that compares
// against a threshold (band selection, isAchieved, bar fill width, radar
// polygon geometry) must keep using the raw percent value, never this.
export function percentToFiveScale(percent: number): number {
  return Math.round((percent / 100) * 5 * 10) / 10;
}

// Convenience for the common "number or null → display string" case.
export function formatFiveScale(percent: number | null, noDataLabel = '—'): string {
  return percent === null ? noDataLabel : percentToFiveScale(percent).toFixed(1);
}

// For a card that shows a score next to a pass/fail badge: when the raw percent is below the
// threshold but both round to the same one-decimal value (e.g. 69.4% vs 70% → "3.5" vs "3.5"),
// the one-decimal score contradicts the "not passed" badge. Show two decimals, rounded down so
// it can never reach the threshold (3.47), and keep one decimal in every other case.
export function formatFiveScaleAgainstThreshold(
  percent: number | null,
  threshold: number | null,
  isAchieved: boolean,
  noDataLabel = '—',
): string {
  if (percent === null) return noDataLabel;
  const needsPrecision =
    !isAchieved &&
    threshold !== null &&
    percent < threshold &&
    percentToFiveScale(percent) >= percentToFiveScale(threshold);
  // +1e-9 guards float error on exact hundredths before flooring.
  return needsPrecision
    ? (Math.floor(percent * 5 + 1e-9) / 100).toFixed(2)
    : percentToFiveScale(percent).toFixed(1);
}
