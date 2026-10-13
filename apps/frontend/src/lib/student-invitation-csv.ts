import { isAxiosError } from 'axios';
import type { CreateStudentInvitationRequest, StaffOverviewReport } from '@eduanalyze-ai/shared-types';
import { createStudentInvitation } from '@/lib/api/staff';
import { parseCsv } from '@/lib/csv';

// CSV identifies Program/Curriculum by human-readable code (not raw UUIDs)
// — staff fill this in by hand, they don't know internal ids. Resolved
// client-side against StaffOverviewReport (already fetched by the page,
// already scoped to the caller's own programs), so no new lookup endpoint
// is needed and a row targeting a program outside scope simply fails to
// resolve here (defense in depth alongside the server's own ScopeGuard).

export const STUDENT_INVITATION_CSV_HEADERS = [
  'รหัสนิสิต',
  'อีเมล',
  'ชื่อ-นามสกุล',
  'รหัสสาขา',
  'ฉบับหลักสูตร',
  'ปีเข้าศึกษา',
];

const STUDENT_CODE_ALIASES = ['รหัสนิสิต', 'รหัสนักศึกษา', 'studentcode', 'student code'];
const EMAIL_ALIASES = ['อีเมล', 'email'];
const FULL_NAME_ALIASES = ['ชื่อ-นามสกุล', 'fullname', 'full name'];
const PROGRAM_CODE_ALIASES = ['รหัสสาขา', 'programcode', 'program code'];
const CURRICULUM_VERSION_ALIASES = ['ฉบับหลักสูตร', 'curriculumversion', 'curriculum version'];
const ADMISSION_YEAR_ALIASES = ['ปีเข้าศึกษา', 'admissionyear', 'admission year'];

interface RowShape {
  rowNumber: number;
  studentCode: string;
  email: string;
  fullName: string;
  programCodeText: string;
  curriculumVersionText: string;
  admissionYearText: string;
}

export interface ReadyInvitationRow extends RowShape {
  verdict: 'ready';
  programId: string;
  curriculumId: string;
  admissionYear: number;
}

export interface InvalidInvitationRow extends RowShape {
  verdict: 'invalid';
  error: string;
}

export type ParsedInvitationRow = ReadyInvitationRow | InvalidInvitationRow;

export interface InvitationImportResultRow {
  rowNumber: number;
  studentCode: string;
  email: string;
  outcome: 'invited' | 'skipped' | 'failed';
  error?: string;
}

export class InvitationCsvFormatError extends Error {}

function findColumn(header: string[], aliases: string[]): number {
  return header.findIndex((cell) => aliases.includes(cell.trim().toLowerCase()));
}

function resolveColumns(header: string[]) {
  const studentCode = findColumn(header, STUDENT_CODE_ALIASES);
  const email = findColumn(header, EMAIL_ALIASES);
  const fullName = findColumn(header, FULL_NAME_ALIASES);
  const programCode = findColumn(header, PROGRAM_CODE_ALIASES);
  const curriculumVersion = findColumn(header, CURRICULUM_VERSION_ALIASES);
  const admissionYear = findColumn(header, ADMISSION_YEAR_ALIASES);

  const missing = [
    studentCode === -1 ? STUDENT_INVITATION_CSV_HEADERS[0] : null,
    email === -1 ? STUDENT_INVITATION_CSV_HEADERS[1] : null,
    fullName === -1 ? STUDENT_INVITATION_CSV_HEADERS[2] : null,
    programCode === -1 ? STUDENT_INVITATION_CSV_HEADERS[3] : null,
    curriculumVersion === -1 ? STUDENT_INVITATION_CSV_HEADERS[4] : null,
    admissionYear === -1 ? STUDENT_INVITATION_CSV_HEADERS[5] : null,
  ].filter((name): name is string => name !== null);

  if (missing.length > 0) {
    throw new InvitationCsvFormatError(
      `ไฟล์ขาดคอลัมน์ที่จำเป็น: ${missing.join(', ')} — ดาวน์โหลดเทมเพลตเพื่อดูรูปแบบที่ถูกต้อง`,
    );
  }
  return { studentCode, email, fullName, programCode, curriculumVersion, admissionYear };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildRow(
  shape: RowShape,
  overview: StaffOverviewReport,
  seenStudentCodes: Set<string>,
  seenEmails: Set<string>,
): ParsedInvitationRow {
  const invalid = (error: string): InvalidInvitationRow => ({ ...shape, verdict: 'invalid', error });

  if (shape.studentCode === '') return invalid('ไม่มีรหัสนิสิต');
  if (seenStudentCodes.has(shape.studentCode)) return invalid('รหัสนิสิตซ้ำในไฟล์');

  if (shape.email === '') return invalid('ไม่มีอีเมล');
  if (!EMAIL_PATTERN.test(shape.email)) return invalid(`อีเมล "${shape.email}" ไม่ถูกต้อง`);
  if (seenEmails.has(shape.email)) return invalid('อีเมลซ้ำในไฟล์');

  if (shape.fullName === '') return invalid('ไม่มีชื่อ-นามสกุล');

  const program = overview.programs.find(
    (p) => p.programCode.trim().toLowerCase() === shape.programCodeText.trim().toLowerCase(),
  );
  if (!program) {
    return invalid(`ไม่พบรหัสสาขา "${shape.programCodeText}" ในขอบเขตที่คุณดูแล`);
  }

  const curriculum = program.curricula.find(
    (c) => c.version.trim() === shape.curriculumVersionText.trim(),
  );
  if (!curriculum) {
    return invalid(
      `ไม่พบฉบับหลักสูตร "${shape.curriculumVersionText}" ในสาขา "${program.programCode}"`,
    );
  }

  const admissionYear = Number(shape.admissionYearText.trim());
  if (!Number.isInteger(admissionYear)) {
    return invalid(`ปีเข้าศึกษา "${shape.admissionYearText}" ไม่ใช่ตัวเลข`);
  }

  return {
    ...shape,
    verdict: 'ready',
    programId: program.programId,
    curriculumId: curriculum.curriculumId,
    admissionYear,
  };
}

/**
 * Pure: parses and validates the whole file without touching the network,
 * resolving programCode/curriculumVersion against StaffOverviewReport (the
 * caller's own scope) so an out-of-scope row fails here with a clear
 * message rather than only at the server's ScopeGuard.
 */
export function parseStudentInvitationCsv(
  text: string,
  overview: StaffOverviewReport,
): ParsedInvitationRow[] {
  const table = parseCsv(text);
  if (table.length === 0) throw new InvitationCsvFormatError('ไฟล์ว่าง');

  const columns = resolveColumns(table[0]);
  const seenStudentCodes = new Set<string>();
  const seenEmails = new Set<string>();
  const rows: ParsedInvitationRow[] = [];

  for (let i = 1; i < table.length; i += 1) {
    const cells = table[i];
    if (cells.every((cell) => cell.trim() === '')) continue;

    const studentCode = (cells[columns.studentCode] ?? '').trim();
    const email = (cells[columns.email] ?? '').trim();
    const row = buildRow(
      {
        rowNumber: i + 1,
        studentCode,
        email,
        fullName: (cells[columns.fullName] ?? '').trim(),
        programCodeText: (cells[columns.programCode] ?? '').trim(),
        curriculumVersionText: (cells[columns.curriculumVersion] ?? '').trim(),
        admissionYearText: (cells[columns.admissionYear] ?? '').trim(),
      },
      overview,
      seenStudentCodes,
      seenEmails,
    );
    if (studentCode !== '') seenStudentCodes.add(studentCode);
    if (email !== '') seenEmails.add(email);
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
  return 'ส่งคำเชิญไม่สำเร็จ';
}

async function inviteOneRow(row: ReadyInvitationRow): Promise<InvitationImportResultRow> {
  const payload: CreateStudentInvitationRequest = {
    email: row.email,
    fullName: row.fullName,
    studentCode: row.studentCode,
    programId: row.programId,
    curriculumId: row.curriculumId,
    admissionYear: row.admissionYear,
  };

  try {
    await createStudentInvitation(payload);
    return { rowNumber: row.rowNumber, studentCode: row.studentCode, email: row.email, outcome: 'invited' };
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 409) {
      return {
        rowNumber: row.rowNumber,
        studentCode: row.studentCode,
        email: row.email,
        outcome: 'skipped',
        error: extractServerMessage(error),
      };
    }
    return {
      rowNumber: row.rowNumber,
      studentCode: row.studentCode,
      email: row.email,
      outcome: 'failed',
      error: extractServerMessage(error),
    };
  }
}

/**
 * Sequential — one HTTP round-trip per invitation naturally rate-limits
 * the resulting email sends (EmailService has no queue of its own), and a
 * bad row never aborts the rest of the batch. Re-running the same file is
 * safe: create() on the server dedupes by email (delete-then-recreate).
 */
export async function executeInvitationImport(
  rows: ReadyInvitationRow[],
): Promise<InvitationImportResultRow[]> {
  const results: InvitationImportResultRow[] = [];
  for (const row of rows) {
    results.push(await inviteOneRow(row));
  }
  return results;
}
