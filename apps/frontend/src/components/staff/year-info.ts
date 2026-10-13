import type { StaffYearLevelsReport } from '@eduanalyze-ai/shared-types';

export interface YearInfo {
  levelById: Map<string, number>;
  behindIds: Set<string>;
  labelByLevel: Map<number, string>;
}

// What the year-level report adds to the student list: which year each active
// student is in, who is behind plan, and what the backend calls each year. The
// counts themselves are not taken from here, so every page counts the same list.
export function yearInfoFrom(report: StaffYearLevelsReport | undefined): YearInfo {
  const info: YearInfo = {
    levelById: new Map(),
    behindIds: new Set(),
    labelByLevel: new Map(),
  };
  for (const bucket of report?.buckets ?? []) {
    info.labelByLevel.set(bucket.yearLevel, bucket.label);
    for (const student of bucket.students) {
      info.levelById.set(student.studentProfileId, bucket.yearLevel);
      if (student.onTrackStatus === 'behind') info.behindIds.add(student.studentProfileId);
    }
  }
  return info;
}

export const YEAR_LEVELS = [1, 2, 3, 4] as const;

export function yearLevelTitle(level: number): string {
  return level >= 4 ? 'ชั้นปีที่ 4 ขึ้นไป' : `ชั้นปีที่ ${level}`;
}

// "ชั้นปี 1–3: ไม่มีนิสิต": years with nobody in them, said once instead of
// as one empty row each. Neighbouring years join into a range; the last year
// is the "and above" bucket. null when every year has someone.
export function describeEmptyYears(levels: readonly number[]): string | null {
  const sorted = [...new Set(levels)].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const runs: number[][] = [];
  for (const level of sorted) {
    const last = runs[runs.length - 1];
    if (last && level === last[last.length - 1] + 1) last.push(level);
    else runs.push([level]);
  }
  const parts = runs.map((run) => {
    const from = run[0];
    const to = run[run.length - 1];
    const range = from === to ? `${from}` : `${from}–${to}`;
    return to >= 4 ? `${range} ขึ้นไป` : range;
  });
  return `ชั้นปี ${parts.join(', ')}: ไม่มีนิสิต`;
}

// One line for the page, in the backend's own terms (common/academic/year-level.ts).
export const BEHIND_PLAN_FORMULA =
  'ตามหลังแผน = หน่วยกิตที่ผ่านแล้วน้อยกว่าที่ควรมีเมื่อต้นปีการศึกษานี้ (หน่วยกิตรวมของหลักสูตร × จำนวนปีที่ผ่านมา ÷ ระยะเวลาของหลักสูตร)';
