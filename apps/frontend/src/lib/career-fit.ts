import type { CareerFitEntry, CareerFitLevel, CareerFitReport } from '@eduanalyze-ai/shared-types';
import type { SemanticTone } from '@/lib/tone';

export const MAX_RANKED_CAREERS = 3;

export const CAREER_FIT_LEVEL_TEXT: Record<CareerFitLevel, string> = {
  HIGH: 'ผลการเรียนของคุณสอดคล้องกับสายนี้มาก',
  MEDIUM: 'ผลการเรียนของคุณสอดคล้องกับสายนี้ในระดับปานกลาง',
  LOW: 'ผลการเรียนของคุณสอดคล้องกับสายนี้น้อย',
};

// LOW is "neutral", not danger: a low fit is information, not a failure.
export const CAREER_FIT_LEVEL_TONE: Record<CareerFitLevel, SemanticTone> = {
  HIGH: 'success',
  MEDIUM: 'warning',
  LOW: 'neutral',
};

export const CAREER_FIT_DISCLAIMER =
  'เป็นข้อเสนอแนะเบื้องต้นจากผลการเรียน ไม่ใช่การประเมินความถนัดหรือความสนใจ ควรปรึกษาอาจารย์ที่ปรึกษาประกอบ';

export const CAREER_FIT_NO_GRADES_TEXT =
  'ยังไม่มีผลการเรียนที่ใช้วิเคราะห์ได้ เมื่อบันทึกผลการเรียนแล้ว ระบบจะแสดงแนวทางอาชีพให้ที่นี่';
export const CAREER_FIT_NO_CAREERS_TEXT = 'หลักสูตรของคุณยังไม่มีข้อมูลสายอาชีพสำหรับวิเคราะห์';
export const CAREER_FIT_INSUFFICIENT_TEXT =
  'ต้องมีผลการเรียนอย่างน้อย 3 วิชาของสายนั้น จึงจะประเมินได้';

// Fewer linked courses than this can never reach the 3-graded-course minimum.
export const CAREER_FIT_MIN_COURSES = 3;
export const CAREER_FIT_FEW_COURSES_TEXT = 'หลักสูตรของคุณมีวิชาในสายนี้น้อย จึงยังประเมินไม่ได้';

export const isFewCourseCareer = (c: Pick<CareerFitEntry, 'totalCourseCount'>) =>
  c.totalCourseCount < CAREER_FIT_MIN_COURSES;

export const careerCoverageText = (
  c: Pick<CareerFitEntry, 'gradedCourseCount' | 'totalCourseCount'>,
) => `ใช้ข้อมูลจาก ${c.gradedCourseCount} จาก ${c.totalCourseCount} วิชาของสายนี้`;

// Number of filled ticks in the 3-tick level bar (visual only; the label carries the meaning).
export const CAREER_FIT_LEVEL_TICKS: Record<CareerFitLevel, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const LEVEL_ORDER: Record<CareerFitLevel, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

export const careerRankText = (rank: number, total: number) => `อันดับ #${rank} จาก ${total} สาย`;

export const CAREER_GROUP_OTHER_NAME = 'อื่น ๆ';
export const CAREER_GROUP_OTHER_KEY = 'other';
export const CAREER_GROUP_INSUFFICIENT_TEXT = 'ข้อมูลยังไม่เพียงพอ';

export interface CareerFitGroupView {
  // Group id, or CAREER_GROUP_OTHER_KEY for careers that have no group yet.
  key: string;
  name: string;
  description: string | null;
  isOther: boolean;
  // Level of the best analysable career in the group (the per-career formula is
  // unchanged: the group is only as high as its best career); null = none analysable.
  level: CareerFitLevel | null;
  // Careers of the group in the API's order: ranked by score, insufficient last.
  careers: CareerFitEntry[];
  analyzedCount: number;
  // Position (0-based, API order) of the group's best analysable career; null = none.
  bestIndex: number | null;
}

// Pure. Groups ordered best-first: highest level of any analysable career in the group, then
// the group holding the better-ranked career, then the group's sortOrder (then name) as the
// final tie-break. Groups with nothing analysable come last (by sortOrder). Ungrouped careers
// form the "other" group, which takes part like any group but loses every sortOrder tie. A
// group appears only when at least one of its careers is in the report.
export function buildCareerFitGroups(careers: CareerFitEntry[]): CareerFitGroupView[] {
  const byKey = new Map<string, { view: CareerFitGroupView; sortOrder: number }>();
  careers.forEach((career, index) => {
    const g = career.group;
    const key = g?.id ?? CAREER_GROUP_OTHER_KEY;
    let entry = byKey.get(key);
    if (!entry) {
      entry = {
        view: {
          key,
          name: g?.name ?? CAREER_GROUP_OTHER_NAME,
          description: g?.description?.trim() || null,
          isOther: !g,
          level: null,
          careers: [],
          analyzedCount: 0,
          bestIndex: null,
        },
        sortOrder: g?.sortOrder ?? Number.MAX_SAFE_INTEGER,
      };
      byKey.set(key, entry);
    }
    const { view } = entry;
    view.careers.push(career);
    if (career.status === 'OK' && career.level !== null) {
      view.analyzedCount++;
      // careers arrive best-first, so the first analysable one is the group's best.
      view.level ??= career.level;
      view.bestIndex ??= index;
    }
  });
  const levelOf = (v: CareerFitGroupView) => (v.level ? LEVEL_ORDER[v.level] : 0);
  return [...byKey.values()]
    .sort(
      (a, b) =>
        levelOf(b.view) - levelOf(a.view) ||
        (a.view.bestIndex ?? Number.MAX_SAFE_INTEGER) -
          (b.view.bestIndex ?? Number.MAX_SAFE_INTEGER) ||
        a.sortOrder - b.sortOrder ||
        a.view.name.localeCompare(b.view.name),
    )
    .map((e) => e.view);
}

// "Best career: X (group Y)" headline; the group part is dropped for an ungrouped career.
export function topCareerSummary(
  top: CareerFitEntry | undefined,
): { careerName: string; groupName: string | null } | null {
  if (!top) return null;
  return { careerName: top.careerName, groupName: top.group?.name ?? null };
}

export interface CareerFitView {
  kind: 'ranked' | 'empty';
  emptyText?: string;
  // True when at least one career belongs to a group; the page then groups its list.
  hasGroups: boolean;
  groups: CareerFitGroupView[];
  ranked: CareerFitEntry[];
  // Analysable careers beyond the top MAX_RANKED_CAREERS, in rank order.
  others: CareerFitEntry[];
  insufficient: CareerFitEntry[];
  analyzedCount: number;
  totalCount: number;
}

// Pure: the API already orders ranked-first; this only splits it into top / others / insufficient.
export function buildCareerFitView(report: CareerFitReport): CareerFitView {
  if (report.status === 'NO_GRADES') {
    return {
      kind: 'empty',
      emptyText: CAREER_FIT_NO_GRADES_TEXT,
      hasGroups: false,
      groups: [],
      ranked: [],
      others: [],
      insufficient: [],
      analyzedCount: 0,
      totalCount: 0,
    };
  }
  if (report.status === 'NO_CAREERS') {
    return {
      kind: 'empty',
      emptyText: CAREER_FIT_NO_CAREERS_TEXT,
      hasGroups: false,
      groups: [],
      ranked: [],
      others: [],
      insufficient: [],
      analyzedCount: 0,
      totalCount: 0,
    };
  }
  const ok = report.careers.filter((c) => c.status === 'OK' && c.level !== null);
  return {
    kind: 'ranked',
    hasGroups: report.careers.some((c) => !!c.group),
    groups: buildCareerFitGroups(report.careers),
    ranked: ok.slice(0, MAX_RANKED_CAREERS),
    others: ok.slice(MAX_RANKED_CAREERS),
    insufficient: report.careers.filter((c) => c.status === 'INSUFFICIENT_DATA'),
    analyzedCount: ok.length,
    totalCount: report.careers.length,
  };
}
