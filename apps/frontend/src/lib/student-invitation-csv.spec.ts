import { translateInvitationError } from './student-invitation-csv';

describe('translateInvitationError', () => {
  it('words the three invitation conflicts in Thai', () => {
    expect(translateInvitationError('Student code "6621601225" is already in use')).toBe(
      'รหัสนิสิตนี้มีบัญชีในระบบแล้ว',
    );
    expect(
      translateInvitationError('Student code "6999000001" already has a pending invitation'),
    ).toBe('รหัสนิสิตนี้มีคำเชิญค้างอยู่แล้ว (อีเมลอื่น)');
    expect(translateInvitationError('An account already exists for a@b.com')).toBe(
      'อีเมลนี้มีบัญชีในระบบแล้ว',
    );
  });

  it('leaves any other message as the server sent it', () => {
    expect(translateInvitationError('Program not found')).toBe('Program not found');
  });
});
