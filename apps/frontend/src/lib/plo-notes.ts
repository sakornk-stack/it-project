import type { StudentPloRadarPoint } from '@eduanalyze-ai/shared-types';

// One place for the wording that explains where a student's PLO figure comes from, so the
// Dashboard, สรุปความถนัด and การวิเคราะห์ CLO/PLO say the same thing. It describes
// plo-achievement.service.ts + gradeToScore (grade point / 4 * 100; F and U = 0; W, I, S and
// courses not yet taken are left out; CLO weights from the curriculum).
export const PLO_METHOD_LINES = [
  'ค่า PLO ของนิสิตคำนวณจากเกรดของวิชาที่เรียนแล้ว โดยแปลงเกรดเป็นคะแนน (A = 100, B = 75, C = 50, D = 25, F = 0 เกรดครึ่งขั้นอยู่ระหว่างกัน) แล้วถ่วงน้ำหนักตามที่หลักสูตรกำหนด',
  'เกรด F และ U นับเป็น 0 ส่วนวิชาที่ยังไม่ได้เรียน และเกรด W, I, S ไม่ถูกนำมาคำนวณ',
  'เป็นการประมาณเบื้องต้นจากเกรด ไม่ใช่ผลประเมินทางการ และผลประเมินตนเองตาม CLO แยกต่างหาก ไม่รวมอยู่ในกราฟนี้',
  'PLO ที่ยังไม่มีวิชาให้คำนวณจะแสดงเป็น "ไม่มีข้อมูล" ไม่ใช่ 0',
] as const;

export const PLO_THRESHOLD_LINE = 'เส้นประสีเหลือง = เกณฑ์ผ่านของหลักสูตร';

export const NO_PLO_CURRICULUM_TITLE = 'หลักสูตรของนิสิตยังไม่มีข้อมูล PLO/CLO ในระบบ';
export const NO_PLO_CURRICULUM_DESCRIPTION =
  'จึงยังไม่มีกราฟและการวิเคราะห์ในหน้านี้ ส่วนอื่น เช่น แผนการเรียนและเครดิต ยังใช้งานได้ตามปกติ';

export const TQF_CURRICULUM_NOTE =
  'หลักสูตรนี้ใช้กรอบ TQF: ผลลัพธ์ระดับหลักสูตรคือผลการเรียนรู้ 5 ด้าน และน้ำหนักของแต่ละวิชามาจากแผนที่กระจายความรับผิดชอบ (● หลัก / ○ รอง) ใน มคอ.2 หลักสูตรปรับปรุง พ.ศ. 2564 เกือบทุกวิชารับผิดชอบหลายด้าน คะแนนแต่ละด้านจึงมักใกล้เคียงกัน';

// Courses the curriculum has an instructor assess (project, special problems, co-op).
export const INSTRUCTOR_ASSESSED_COURSE_CODES: ReadonlySet<string> = new Set([
  '02739499',
  '02739498',
  '02739490',
]);
export const INSTRUCTOR_ASSESSED_NOTE =
  'ผลของวิชานี้ประเมินโดยอาจารย์ตามที่หลักสูตรระบุ';

// The 2564 curriculum is TQF: its "PLOs" are the five TQF domains from the มคอ.2 Curriculum
// Mapping, not OBE PLOs.
export function isTqfCurriculum(curriculum: {
  version: string;
  effectiveYear: number;
}): boolean {
  return curriculum.version === '2564' || curriculum.effectiveYear === 2564;
}

// "X of Y courses" behind one PLO: distinct courses of its CLOs, and how many of them have a
// score. Read straight off the breakdown the API already returns.
export function ploCoverage(plo: Pick<StudentPloRadarPoint, 'cloBreakdown'>): {
  used: number;
  total: number;
} {
  const all = new Set<string>();
  const used = new Set<string>();
  for (const clo of plo.cloBreakdown) {
    all.add(clo.courseId);
    if (clo.score !== null) used.add(clo.courseId);
  }
  return { used: used.size, total: all.size };
}
