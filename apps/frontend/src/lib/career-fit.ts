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

export const careerCoverageText = (
  c: Pick<CareerFitEntry, 'gradedCourseCount' | 'totalCourseCount'>,
) => `ใช้ข้อมูลจาก ${c.gradedCourseCount} จาก ${c.totalCourseCount} วิชาของสายนี้`;

export interface CareerFitView {
  kind: 'ranked' | 'empty';
  emptyText?: string;
  ranked: CareerFitEntry[];
  insufficient: CareerFitEntry[];
}

// Pure: the API already orders ranked-first; this only splits and trims.
export function buildCareerFitView(report: CareerFitReport): CareerFitView {
  if (report.status === 'NO_GRADES') {
    return { kind: 'empty', emptyText: CAREER_FIT_NO_GRADES_TEXT, ranked: [], insufficient: [] };
  }
  if (report.status === 'NO_CAREERS') {
    return { kind: 'empty', emptyText: CAREER_FIT_NO_CAREERS_TEXT, ranked: [], insufficient: [] };
  }
  const ok = report.careers.filter((c) => c.status === 'OK' && c.level !== null);
  return {
    kind: 'ranked',
    ranked: ok.slice(0, MAX_RANKED_CAREERS),
    // Ranked careers beyond the top 3 are not "insufficient"; they stay hidden.
    insufficient: report.careers.filter((c) => c.status === 'INSUFFICIENT_DATA'),
  };
}
