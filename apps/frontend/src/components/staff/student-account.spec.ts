import { buildProfileUpdate, isStudentSuspended, reasonIsLongEnough } from './student-account';

const profile = { programId: 'p1', curriculumId: 'c1', admissionYear: 2025 };
const unchanged = { ...profile, reason: '  แก้ข้อมูลผิด  ' };

describe('buildProfileUpdate', () => {
  it('sends only the changed fields, with the trimmed reason', () => {
    expect(buildProfileUpdate(profile, { ...unchanged, admissionYear: 2026 })).toEqual({
      admissionYear: 2026,
      reason: 'แก้ข้อมูลผิด',
    });
    expect(
      buildProfileUpdate(profile, { ...unchanged, programId: 'p2', curriculumId: 'c2' }),
    ).toEqual({ programId: 'p2', curriculumId: 'c2', reason: 'แก้ข้อมูลผิด' });
  });

  it('is null when nothing changed', () => {
    expect(buildProfileUpdate(profile, unchanged)).toBeNull();
  });

  it('never carries a student code', () => {
    const dto = buildProfileUpdate(profile, { ...unchanged, admissionYear: 2026 });
    expect(dto).not.toHaveProperty('studentCode');
  });
});

describe('reasonIsLongEnough', () => {
  it('needs 5 characters once spaces are dropped', () => {
    expect(reasonIsLongEnough('     ')).toBe(false);
    expect(reasonIsLongEnough(' ลาออก ')).toBe(true);
  });
});

describe('isStudentSuspended', () => {
  it('is suspended when either switch is off', () => {
    expect(isStudentSuspended({ isActive: true, user: { isActive: true } } as never)).toBe(false);
    expect(isStudentSuspended({ isActive: false, user: { isActive: true } } as never)).toBe(true);
    expect(isStudentSuspended({ isActive: true, user: { isActive: false } } as never)).toBe(true);
  });
});
