import type { AuditLogEntry } from '@eduanalyze-ai/shared-types';
import { describeAuditEntry, isGradeAction, type AuditLabelLookups } from './describe-audit-entry';

const labels: AuditLabelLookups = {
  course: (id) => ({ c1: 'IT101 การเขียนโปรแกรม' })[id],
  semester: (id) => ({ s1: 'ภาคต้น / 2568' })[id],
  program: (id) => ({ p1: 'IT', p2: 'CS' })[id],
  curriculum: (id) => ({ k1: '2564', k2: '2569' })[id],
  role: (role) => ({ STAFF: 'เจ้าหน้าที่', INSTRUCTOR: 'อาจารย์' })[role as string] ?? role,
};

function entry(overrides: Partial<AuditLogEntry>): AuditLogEntry {
  return {
    id: 'a1',
    action: 'GRADE_UPDATE',
    actorRole: 'STAFF',
    actorName: 'เจ้าหน้าที่ หนึ่ง',
    targetId: 'r1',
    before: null,
    after: null,
    reason: null,
    createdAt: '2026-10-18T08:00:00.000Z',
    ...overrides,
  };
}

describe('describeAuditEntry', () => {
  it('shows a grade change with course, term and old → new grade', () => {
    const view = describeAuditEntry(
      entry({
        before: { grade: 'B', courseId: 'c1', semesterId: 's1' },
        after: { grade: 'A', courseId: 'c1', semesterId: 's1' },
      }),
      labels,
    );
    expect(view).toEqual({
      title: 'แก้เกรด',
      detail: 'IT101 การเขียนโปรแกรม · ภาคต้น / 2568 · B → A',
      actor: 'เจ้าหน้าที่ หนึ่ง (เจ้าหน้าที่)',
    });
  });

  it('shows an added and a removed grade', () => {
    const row = { grade: 'F', courseId: 'c1', semesterId: 's1' };
    expect(describeAuditEntry(entry({ action: 'GRADE_CREATE', after: row }), labels).detail).toBe(
      'IT101 การเขียนโปรแกรม · ภาคต้น / 2568 · เกรด F',
    );
    expect(
      describeAuditEntry(
        entry({ action: 'GRADE_DELETE', before: row, actorRole: 'INSTRUCTOR' }),
        labels,
      ),
    ).toMatchObject({ title: 'ลบรายวิชา', actor: 'เจ้าหน้าที่ หนึ่ง (อาจารย์)' });
  });

  it('names a course the page no longer knows as missing, not as a raw id', () => {
    const view = describeAuditEntry(
      entry({ action: 'GRADE_CREATE', after: { grade: 'A', courseId: 'gone', semesterId: 's1' } }),
      labels,
    );
    expect(view.detail).toBe('ไม่พบข้อมูล · ภาคต้น / 2568 · เกรด A');
  });

  it('lists only the profile fields that changed', () => {
    const view = describeAuditEntry(
      entry({
        action: 'STUDENT_PROFILE_UPDATE',
        before: { programId: 'p1', curriculumId: 'k1' },
        after: { programId: 'p2', curriculumId: 'k2', plannedCoursesRemoved: 2 },
      }),
      labels,
    );
    expect(view.detail).toBe(
      'สาขา IT → CS · หลักสูตร 2564 → 2569 · ลบแผนเรียน 2 วิชาที่ไม่อยู่ในหลักสูตรใหม่',
    );
    expect(
      describeAuditEntry(
        entry({
          action: 'STUDENT_PROFILE_UPDATE',
          before: { admissionYear: 2025 },
          after: { admissionYear: 2026 },
        }),
        labels,
      ).detail,
    ).toBe('ปีเข้า 2025 → 2026');
  });

  it('has no detail line for a suspension (the reason is shown on its own)', () => {
    expect(describeAuditEntry(entry({ action: 'STUDENT_SUSPEND' }), labels)).toMatchObject({
      title: 'ระงับบัญชี',
      detail: null,
    });
  });

  it('labels an actor whose account was deleted since', () => {
    expect(describeAuditEntry(entry({ actorName: null }), labels).actor).toBe(
      'บัญชีที่ถูกลบแล้ว (เจ้าหน้าที่)',
    );
  });
});

describe('isGradeAction', () => {
  it('is true only for grade actions', () => {
    expect(isGradeAction('GRADE_DELETE')).toBe(true);
    expect(isGradeAction('STUDENT_SUSPEND')).toBe(false);
  });
});
