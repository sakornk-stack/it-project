import type { AuditAction, AuditLogEntry, AuditSnapshot, Role } from '@eduanalyze-ai/shared-types';

// Resolves the ids an audit snapshot keeps into what the page can name; each
// returns undefined for an id it no longer knows (e.g. a deactivated course).
// `role` is passed in (ROLE_LABEL_TH) so this file stays free of React.
export interface AuditLabelLookups {
  course: (id: string) => string | undefined;
  semester: (id: string) => string | undefined;
  program: (id: string) => string | undefined;
  curriculum: (id: string) => string | undefined;
  role: (role: Role) => string;
}

export interface AuditEntryView {
  title: string;
  detail: string | null;
  actor: string;
}

const TITLES: Record<AuditAction, string> = {
  GRADE_CREATE: 'เพิ่มผลการเรียน',
  GRADE_UPDATE: 'แก้เกรด',
  GRADE_DELETE: 'ลบรายวิชา',
  STUDENT_SUSPEND: 'ระงับบัญชี',
  STUDENT_REACTIVATE: 'เปิดบัญชีอีกครั้ง',
  STUDENT_PROFILE_UPDATE: 'แก้ไขข้อมูลนิสิต',
  STUDENT_INVITATION_CANCEL: 'ยกเลิกคำเชิญ',
};

const UNKNOWN = 'ไม่พบข้อมูล';
export const DELETED_ACTOR_LABEL = 'บัญชีที่ถูกลบแล้ว';

export function isGradeAction(action: AuditAction): boolean {
  return action === 'GRADE_CREATE' || action === 'GRADE_UPDATE' || action === 'GRADE_DELETE';
}

function text(snapshot: AuditSnapshot | null, key: string): string | undefined {
  const value = snapshot?.[key];
  return value === null || value === undefined ? undefined : String(value);
}

function named(lookup: (id: string) => string | undefined, id: string | undefined): string {
  return (id && lookup(id)) ?? UNKNOWN;
}

function gradeDetail(entry: AuditLogEntry, labels: AuditLabelLookups): string {
  const row = entry.after ?? entry.before;
  const where = `${named(labels.course, text(row, 'courseId'))} · ${named(labels.semester, text(row, 'semesterId'))}`;
  const before = text(entry.before, 'grade');
  const after = text(entry.after, 'grade');
  if (entry.action === 'GRADE_CREATE') return `${where} · เกรด ${after ?? UNKNOWN}`;
  if (entry.action === 'GRADE_DELETE') return `${where} · เกรดเดิม ${before ?? UNKNOWN}`;
  return `${where} · ${before ?? UNKNOWN} → ${after ?? UNKNOWN}`;
}

function profileDetail(entry: AuditLogEntry, labels: AuditLabelLookups): string {
  const parts: string[] = [];
  const change = (key: string, label: string, lookup?: (id: string) => string | undefined) => {
    const before = text(entry.before, key);
    const after = text(entry.after, key);
    if (before === undefined && after === undefined) return;
    const show = (v: string | undefined) => (lookup ? named(lookup, v) : (v ?? UNKNOWN));
    parts.push(`${label} ${show(before)} → ${show(after)}`);
  };
  change('programId', 'สาขา', labels.program);
  change('curriculumId', 'หลักสูตร', labels.curriculum);
  change('admissionYear', 'ปีเข้า');
  const removed = text(entry.after, 'plannedCoursesRemoved');
  if (removed) parts.push(`ลบแผนเรียน ${removed} วิชาที่ไม่อยู่ในหลักสูตรใหม่`);
  return parts.join(' · ');
}

// One history row in plain Thai. The reason is shown by the caller as is.
export function describeAuditEntry(
  entry: AuditLogEntry,
  labels: AuditLabelLookups,
): AuditEntryView {
  const actor = `${entry.actorName ?? DELETED_ACTOR_LABEL} (${labels.role(entry.actorRole)})`;
  let detail: string | null = null;
  if (isGradeAction(entry.action)) detail = gradeDetail(entry, labels);
  else if (entry.action === 'STUDENT_PROFILE_UPDATE') detail = profileDetail(entry, labels);
  return { title: TITLES[entry.action], detail, actor };
}
