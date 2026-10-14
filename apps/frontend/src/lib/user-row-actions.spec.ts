import { userMenuEntries } from './user-row-actions';

describe('userMenuEntries', () => {
  it('lists resend then a destructive suspend for an active user who must set a password', () => {
    expect(userMenuEntries({ canResend: true, statusBlocked: false, isActive: true })).toEqual([
      { key: 'resend', label: 'ส่งคำเชิญซ้ำ' },
      { key: 'suspend', label: 'ระงับการใช้งาน', destructive: true },
    ]);
  });

  it('offers a normal reactivate for a suspended user', () => {
    expect(userMenuEntries({ canResend: false, statusBlocked: false, isActive: false })).toEqual([
      { key: 'reactivate', label: 'เปิดใช้งานอีกครั้ง' },
    ]);
  });

  it('is empty when nothing is allowed, so the row gets no menu button', () => {
    expect(userMenuEntries({ canResend: false, statusBlocked: true, isActive: true })).toEqual([]);
  });

  it('keeps only resend when the status change is blocked', () => {
    expect(
      userMenuEntries({ canResend: true, statusBlocked: true, isActive: true }).map((e) => e.key),
    ).toEqual(['resend']);
  });

  it('puts a destructive permanent delete last, after reactivate', () => {
    expect(
      userMenuEntries({ canResend: false, statusBlocked: false, isActive: false, canDelete: true }),
    ).toEqual([
      { key: 'reactivate', label: 'เปิดใช้งานอีกครั้ง' },
      { key: 'delete', label: 'ลบถาวร', destructive: true },
    ]);
  });

  it('can offer delete even when the status change is blocked', () => {
    expect(
      userMenuEntries({
        canResend: false,
        statusBlocked: true,
        isActive: false,
        canDelete: true,
      }).map((e) => e.key),
    ).toEqual(['delete']);
  });

  it('puts the detail-page entries first when the row allows them', () => {
    expect(
      userMenuEntries({
        canOpen: true,
        canEdit: true,
        canResend: true,
        statusBlocked: false,
        isActive: true,
      }).map((e) => e.key),
    ).toEqual(['view', 'edit', 'resend', 'suspend']);
  });

  it('offers only "view" on a row that cannot be managed', () => {
    expect(
      userMenuEntries({ canOpen: true, canResend: false, statusBlocked: true, isActive: true }),
    ).toEqual([{ key: 'view', label: 'ดูรายละเอียด' }]);
  });
});
