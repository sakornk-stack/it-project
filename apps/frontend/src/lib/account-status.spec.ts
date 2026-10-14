import { accountStatus } from './account-status';

describe('accountStatus', () => {
  it('is green and live for an active account with a password', () => {
    expect(accountStatus({ isActive: true, mustChangePassword: false })).toEqual({
      tone: 'success',
      label: 'ใช้งานปกติ',
      live: true,
    });
  });

  it('is yellow while the password is still to be set', () => {
    expect(accountStatus({ isActive: true, mustChangePassword: true }).tone).toBe('warning');
  });

  it('is red for a suspended account, whatever its password state', () => {
    expect(accountStatus({ isActive: false, mustChangePassword: true }).tone).toBe('danger');
    expect(accountStatus({ isActive: false, mustChangePassword: false }).live).toBe(false);
  });
});
