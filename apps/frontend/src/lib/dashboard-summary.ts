import type { GpaTrendPoint } from '@eduanalyze-ai/shared-types';
import { computeGpaChange, formatGpaChange } from '@/lib/gpa-change';

// The slice of StudentDashboardResponse the summary reads (structurally
// satisfied by the full response).
export interface DashboardSummaryInput {
  gpa: number | null;
  gpaTrend: readonly Pick<GpaTrendPoint, 'gpa'>[];
  creditsEarned: number;
  totalCreditsRequired: number;
  onTrackStatus: 'on_track' | 'behind' | null;
  graduationReadiness: { isReady: boolean; missingRequiredCount: number };
}

const isCount = (n: number) => Number.isFinite(n) && n >= 0;

// One short line built only from fields the dashboard already returned. Every
// part is dropped when its data is missing or not a real number, so the line
// never shows undefined/NaN or a made-up 0; null means nothing to say. A null
// GPA means "no graded terms yet" and is skipped, whereas a real 0.00 is shown.
export function buildDashboardSummary(input: DashboardSummaryInput): string | null {
  const { gpa, gpaTrend, creditsEarned, totalCreditsRequired, onTrackStatus, graduationReadiness } = input;
  const isReady = graduationReadiness?.isReady === true;

  const hasGpa = gpa !== null && Number.isFinite(gpa);
  const credits =
    isCount(creditsEarned) && Number.isFinite(totalCreditsRequired) && totalCreditsRequired > 0
      ? `สะสม ${creditsEarned}/${totalCreditsRequired} หน่วยกิต`
      : null;

  if (isReady) {
    return ['ยินดีด้วย! นิสิตพร้อมสำเร็จการศึกษา', hasGpa ? `GPA ${gpa.toFixed(2)}` : null, credits]
      .filter((part): part is string => part !== null)
      .join(' · ');
  }

  let gpaPart: string | null = null;
  if (hasGpa) {
    const change = computeGpaChange(gpaTrend);
    gpaPart = `GPA ${gpa.toFixed(2)}`;
    if (change) gpaPart += ` (${formatGpaChange(change, { signed: false })})`;
  }

  const status =
    onTrackStatus === 'on_track' ? 'ตามแผน' : onTrackStatus === 'behind' ? 'ตามหลังแผน' : null;

  const missing = graduationReadiness?.missingRequiredCount;
  const missingPart =
    typeof missing === 'number' && Number.isFinite(missing) && missing > 0
      ? `วิชาบังคับที่ยังขาด ${missing} วิชา`
      : null;

  const parts = [gpaPart, credits, status, missingPart].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(' · ') : null;
}
