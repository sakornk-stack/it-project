import { isAxiosError } from 'axios';
import type {
  AssessmentScoreStatus,
  StudentRosterEntry,
  UpsertStudentAssessmentScoreRequest,
} from '@eduanalyze-ai/shared-types';
import { upsertStudentAssessmentScore } from '@/lib/api/assessment-evidence';
import { parseCsv } from '@/lib/csv';
import { ASSESSMENT_SCORE_STATUS_LABELS } from '@/lib/grade-label';

// CSV import for one assessment-CLO mapping: the file carries only student
// code + score + status, and the mapping is whatever the user already picked
// in the panel. Keeping the mapping out of the file is what makes the import
// safe — a raw score is normalized against that mapping's own
// `maxScoreOverride ?? maxScore`, so a file that spanned several mappings
// could silently normalize a score against the wrong maximum.

export const SCORE_CSV_HEADERS = ['รหัสนิสิต', 'ชื่อ-นามสกุล', 'คะแนน', 'สถานะ'];

const STUDENT_CODE_ALIASES = ['รหัสนิสิต', 'รหัสนักศึกษา', 'studentcode', 'student code'];
const SCORE_ALIASES = ['คะแนน', 'score'];
const STATUS_ALIASES = ['สถานะ', 'status'];

interface RowShape {
  rowNumber: number;
  studentCode: string;
  fullName: string;
  scoreText: string;
  statusText: string;
}

export interface ReadyScoreRow extends RowShape {
  verdict: 'ready';
  studentCourseRecordId: string;
  status: AssessmentScoreStatus;
  // Omitted unless status is GRADED — see importOneRow.
  score?: number;
}

export interface InvalidScoreRow extends RowShape {
  verdict: 'invalid';
  error: string;
}

export type ParsedScoreRow = ReadyScoreRow | InvalidScoreRow;

export interface ImportResultRow {
  rowNumber: number;
  studentCode: string;
  outcome: 'imported' | 'failed';
  error?: string;
}

export class ScoreCsvFormatError extends Error {}

function findColumn(header: string[], aliases: string[]): number {
  return header.findIndex((cell) => aliases.includes(cell.trim().toLowerCase()));
}

function resolveColumns(header: string[]) {
  const studentCode = findColumn(header, STUDENT_CODE_ALIASES);
  const score = findColumn(header, SCORE_ALIASES);
  const status = findColumn(header, STATUS_ALIASES);

  const missing = [
    studentCode === -1 ? SCORE_CSV_HEADERS[0] : null,
    score === -1 ? SCORE_CSV_HEADERS[2] : null,
    status === -1 ? SCORE_CSV_HEADERS[3] : null,
  ].filter((name): name is string => name !== null);

  if (missing.length > 0) {
    throw new ScoreCsvFormatError(
      `ไฟล์ขาดคอลัมน์ที่จำเป็น: ${missing.join(', ')} — ดาวน์โหลดเทมเพลตเพื่อดูรูปแบบที่ถูกต้อง`,
    );
  }
  return { studentCode, score, status };
}

const STATUS_BY_LABEL = new Map<string, AssessmentScoreStatus>(
  Object.entries(ASSESSMENT_SCORE_STATUS_LABELS).map(([value, label]) => [
    label,
    value as AssessmentScoreStatus,
  ]),
);

function normalizeStatus(raw: string): AssessmentScoreStatus | null {
  const text = raw.trim();
  const byLabel = STATUS_BY_LABEL.get(text);
  if (byLabel) return byLabel;
  const upper = text.toUpperCase();
  return upper in ASSESSMENT_SCORE_STATUS_LABELS ? (upper as AssessmentScoreStatus) : null;
}

// The backend enforces score-present iff status is GRADED and 400s otherwise
// (student-assessment-score.service.ts), so catch it here instead of spending
// a request to be told. The max check exists nowhere else at all: without it
// an over-max score normalizes to >100%.
function validateScore(
  scoreText: string,
  status: AssessmentScoreStatus,
  effectiveMax: number,
): { score?: number; error?: string } {
  const text = scoreText.trim();

  if (status !== 'GRADED') {
    return text === ''
      ? {}
      : { error: `สถานะ "${ASSESSMENT_SCORE_STATUS_LABELS[status]}" ต้องไม่มีคะแนน` };
  }
  if (text === '') {
    return { error: 'สถานะ "ตรวจแล้ว" ต้องมีคะแนน' };
  }

  const score = Number(text);
  if (!Number.isFinite(score)) return { error: `คะแนน "${text}" ไม่ใช่ตัวเลข` };
  if (score < 0) return { error: 'คะแนนติดลบไม่ได้' };
  if (score > effectiveMax) return { error: `คะแนนเกินคะแนนเต็ม (${effectiveMax})` };
  return { score };
}

function buildRow(
  shape: RowShape,
  roster: Map<string, StudentRosterEntry>,
  seen: Set<string>,
  effectiveMax: number,
): ParsedScoreRow {
  const invalid = (error: string): InvalidScoreRow => ({ ...shape, verdict: 'invalid', error });

  if (shape.studentCode === '') return invalid('ไม่มีรหัสนิสิต');
  if (seen.has(shape.studentCode)) return invalid('รหัสนิสิตซ้ำในไฟล์');

  const student = roster.get(shape.studentCode);
  if (!student) return invalid('ไม่พบรหัสนิสิตนี้ในรายชื่อของรายวิชา');

  const status = normalizeStatus(shape.statusText);
  if (!status) {
    return invalid(
      shape.statusText.trim() === ''
        ? 'ไม่มีสถานะ'
        : `สถานะ "${shape.statusText.trim()}" ไม่ถูกต้อง`,
    );
  }

  const { score, error } = validateScore(shape.scoreText, status, effectiveMax);
  if (error) return invalid(error);

  return {
    ...shape,
    fullName: student.fullName,
    verdict: 'ready',
    studentCourseRecordId: student.studentCourseRecordId,
    status,
    ...(score === undefined ? {} : { score }),
  };
}

/**
 * Pure: parses and validates the whole file without touching the network, so
 * the dialog can show a verdict per row before anything is written.
 * `effectiveMax` is the mapping's `maxScoreOverride ?? definition.maxScore`.
 */
export function parseScoreCsv(
  text: string,
  rosterEntries: StudentRosterEntry[],
  effectiveMax: number,
): ParsedScoreRow[] {
  const table = parseCsv(text);
  if (table.length === 0) throw new ScoreCsvFormatError('ไฟล์ว่าง');

  const columns = resolveColumns(table[0]);
  const roster = new Map(rosterEntries.map((entry) => [entry.studentCode, entry]));
  const seen = new Set<string>();
  const rows: ParsedScoreRow[] = [];

  for (let i = 1; i < table.length; i += 1) {
    const cells = table[i];
    if (cells.every((cell) => cell.trim() === '')) continue;

    const studentCode = (cells[columns.studentCode] ?? '').trim();
    const row = buildRow(
      {
        // Matches the spreadsheet's own row numbering (header is row 1).
        rowNumber: i + 1,
        studentCode,
        fullName: '',
        scoreText: cells[columns.score] ?? '',
        statusText: cells[columns.status] ?? '',
      },
      roster,
      seen,
      effectiveMax,
    );
    if (studentCode !== '') seen.add(studentCode);
    rows.push(row);
  }

  return rows;
}

function extractServerMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }
  return 'บันทึกไม่สำเร็จ';
}

async function importOneRow(
  row: ReadyScoreRow,
  context: { courseId: string; assessmentCloMappingId: string },
): Promise<ImportResultRow> {
  const payload: UpsertStudentAssessmentScoreRequest = {
    assessmentCloMappingId: context.assessmentCloMappingId,
    studentCourseRecordId: row.studentCourseRecordId,
    status: row.status,
    courseId: context.courseId,
  };
  // The key must be absent, not null: the service tests `score === undefined`
  // while @IsOptional() lets an explicit null through to a guaranteed 400.
  if (row.status === 'GRADED') payload.score = row.score;

  try {
    await upsertStudentAssessmentScore(payload);
    return { rowNumber: row.rowNumber, studentCode: row.studentCode, outcome: 'imported' };
  } catch (error) {
    return {
      rowNumber: row.rowNumber,
      studentCode: row.studentCode,
      outcome: 'failed',
      error: extractServerMessage(error),
    };
  }
}

/**
 * Writes the ready rows one at a time, turning every failure into a result row
 * so one bad row can never abort the rest of the batch — the flaw in the
 * manual save path this importer exists to replace. Re-running the same file
 * is safe: the endpoint is a real upsert on a unique key, not a create.
 */
export async function executeScoreImport(
  rows: ReadyScoreRow[],
  context: { courseId: string; assessmentCloMappingId: string },
): Promise<ImportResultRow[]> {
  const results: ImportResultRow[] = [];
  for (const row of rows) {
    results.push(await importOneRow(row, context));
  }
  return results;
}
