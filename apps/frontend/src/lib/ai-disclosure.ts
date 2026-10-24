// Shown right before any control that calls GET /ai-analysis (fetchAiSkillAnalysis),
// which sends the student's computed grade data to Anthropic. No screen calls it
// today (the "สรุปผลการประเมิน" card is rule-based, lib/interpret-plo-radar.ts), so
// this text must not be placed on anything that does not actually call the API.
export const AI_DISCLOSURE_NOTE =
  'เมื่อกดวิเคราะห์ ระบบจะส่งผลการเรียนที่คำนวณแล้วของคุณ (เช่น GPA หน่วยกิต ค่า PLO และเกรดรายวิชา) ให้ Anthropic เพื่อสร้างคำอธิบาย โดยไม่ส่งชื่อ อีเมล หรือรหัสนิสิต';
