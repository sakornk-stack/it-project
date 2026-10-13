import { isLastRole, revokeRoleDescription } from './user-role-revoke';

describe('user role revoke', () => {
  it('detects the only remaining role', () => {
    expect(isLastRole(['STAFF'], 'STAFF')).toBe(true);
    expect(isLastRole(['STAFF', 'INSTRUCTOR'], 'STAFF')).toBe(false);
  });

  it('warns about an account with no roles only for the last one', () => {
    expect(revokeRoleDescription('เจ้าหน้าที่', true)).toContain('ไม่มีบทบาทเหลืออยู่');
    expect(revokeRoleDescription('เจ้าหน้าที่', false)).not.toContain('บทบาทสุดท้าย');
  });
});
