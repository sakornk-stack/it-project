// One vocabulary for credit figures so a name never carries two meanings.
//
// - "ความคืบหน้าหน่วยกิต" is only the credits ratio (creditsPassed / total, capped at 100%).
// - "ความพร้อมสำเร็จการศึกษา" is the whole verdict (GraduationReadiness.isReady): credits met,
//   every category met and no required course missing. Never use it for the ratio alone.
// - "หน่วยกิตสะสม" counts passed curriculum courses (A–D, S); F, U, W and I are not counted.
//   "หน่วยกิตที่นับ GPA" is a different figure (it includes F) and is named separately.
export const CREDIT_PROGRESS_LABEL = 'ความคืบหน้าหน่วยกิต';
export const CREDIT_PROGRESS_NOTE =
  'หน่วยกิตที่ผ่านเทียบกับเกณฑ์ของหลักสูตร (ยังไม่รวมวิชาบังคับและหมวดวิชา)';
export const GRADUATION_READINESS_LABEL = 'ความพร้อมสำเร็จการศึกษา';
export const GRADUATION_READINESS_NOTE =
  'พร้อมเมื่อครบทั้ง 3 ข้อ: หน่วยกิตรวม วิชาบังคับ และหมวดวิชา';
export const CREDITS_EARNED_NOTE = 'นับวิชาในหลักสูตรที่ผ่าน (รวม S) ไม่นับ F, U, W, I';
