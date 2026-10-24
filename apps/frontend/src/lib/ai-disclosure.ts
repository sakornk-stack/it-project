// Shown right before any control that calls the Anthropic-backed endpoints in
// lib/api/ai-analysis.ts, which send the student's computed grade data to
// Anthropic. Used by the AI career suggestions card (components/career-fit/
// ai-career-suggestions.tsx); the "สรุปผลการประเมิน" card is rule-based
// (lib/interpret-plo-radar.ts), so this text must not be placed on it or on
// anything else that does not actually call the API.
export const AI_DISCLOSURE_NOTE =
  'เมื่อกดวิเคราะห์ ระบบจะส่งผลการเรียนที่คำนวณแล้วของคุณ (เช่น GPA หน่วยกิต ค่า PLO และเกรดรายวิชา) ให้ Anthropic เพื่อสร้างคำอธิบาย โดยไม่ส่งชื่อ อีเมล หรือรหัสนิสิต';
