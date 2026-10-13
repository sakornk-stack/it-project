import type {
  CohortPloAchievementReport,
  LowestCloEntry,
  RadarPoint,
} from '@eduanalyze-ai/shared-types';
import { INSUFFICIENT_BELOW } from '@/lib/course-snapshot';
import type { SemanticTone } from '@/lib/tone';

// What the Admin curriculum quality page works out from
// GET /dashboard/curriculum/:id, apart from React so it can be tested alone.

export const LOWEST_SHOWN = 3;
export const GPA_SCALE_MAX = 4;

// The PLOs with the lowest measured value, lowest first. A PLO with no data
// (value null) is not "lowest" — nothing was measured — so it is left out.
// Ties break on code so the order never shuffles between renders.
export function lowestPlos(radar: readonly RadarPoint[], limit = LOWEST_SHOWN): RadarPoint[] {
  return radar
    .filter((plo): plo is RadarPoint & { value: number } => plo.value !== null)
    .sort((a, b) => a.value - b.value || a.code.localeCompare(b.code))
    .slice(0, limit);
}

// lowestClos holds EVERY CLO tied at the minimum, and CLOs in one course
// share that course's number, so a tie can be long: show the first few and
// say how many more share the value.
export function summarizeLowestClos(
  clos: readonly LowestCloEntry[],
  limit = LOWEST_SHOWN,
): { shown: LowestCloEntry[]; hiddenCount: number } {
  const ordered = [...clos].sort((a, b) => a.code.localeCompare(b.code));
  return { shown: ordered.slice(0, limit), hiddenCount: Math.max(0, ordered.length - limit) };
}

// Fewer people with a GPA than INSUFFICIENT_BELOW: numbers may be shown but
// not read as a verdict. Judged on people with a GPA, not on enrolment.
export function hasLittleData(gpaSampleSize: number): boolean {
  return !(gpaSampleSize >= INSUFFICIENT_BELOW);
}

export const LITTLE_DATA_LABEL = 'ข้อมูลยังน้อย — สรุปได้เบื้องต้น';

// GPA as a 0-100 bar fill; null (nobody graded) is an empty bar, never a 0.00.
export function gpaBarPercent(gpa: number | null): number {
  if (gpa === null) return 0;
  return Math.max(0, Math.min(100, (gpa / GPA_SCALE_MAX) * 100));
}

// Newest intake first: the latest cohort is the one an Admin looks at before the older ones.
export function sortCohorts(
  cohorts: readonly CohortPloAchievementReport[],
): CohortPloAchievementReport[] {
  return [...cohorts].sort((a, b) => b.admissionYear - a.admissionYear);
}

// A GPA read against the system-wide status bands (the wording of STATUS_RULES in
// staff-status.ts: below 1.50 / 1.50-1.74 / 1.75 and up). The server decides each
// student's band; this only names where an average falls, so a bar can carry a colour
// AND a word. null = nobody graded, no verdict.
export interface GpaStatus {
  tone: SemanticTone;
  label: string;
}

const GPA_CRITICAL_BELOW = 1.5;
const GPA_WATCH_BELOW = 1.75;

export function gpaStatus(gpa: number | null): GpaStatus | null {
  if (gpa === null) return null;
  if (gpa < GPA_CRITICAL_BELOW) return { tone: 'danger', label: 'ต่ำกว่าเกณฑ์' };
  if (gpa < GPA_WATCH_BELOW) return { tone: 'warning', label: 'เฝ้าระวัง' };
  return { tone: 'success', label: 'ตามเกณฑ์' };
}

export function hasAnyPloData(radar: readonly RadarPoint[]): boolean {
  return radar.some((plo) => plo.value !== null);
}

// GPA is always written with two decimals ("2.50"), wherever /admin/** shows one.
export function formatGpa(gpa: number | null, noDataLabel = '—'): string {
  return gpa === null ? noDataLabel : gpa.toFixed(2);
}

// A PLO value (0-100 percent, stored raw) as the five-point score with two
// decimals. Only the text is rounded; ranking always uses the raw value.
export function formatPloScore(percent: number | null, noDataLabel = '—'): string {
  return percent === null ? noDataLabel : ((percent / 100) * 5).toFixed(2);
}

export const CLOSE_SCORES_NOTE = 'คะแนนต่ำสุดใกล้เคียงกัน ลำดับด้านล่างใช้อ้างอิงเท่านั้น';
const CLOSE_SCORE_SPREAD = 0.05;

// True when the listed PLOs span less than 0.05 points on the five-point scale,
// so their order is not a meaningful ranking.
export function ploScoresAreClose(plos: readonly RadarPoint[]): boolean {
  const values = plos.map((p) => p.value).filter((v): v is number => v !== null);
  if (values.length < 2) return false;
  const spread = ((Math.max(...values) - Math.min(...values)) / 100) * 5;
  return spread < CLOSE_SCORE_SPREAD;
}
