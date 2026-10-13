export interface UserMenuEntry {
  key: 'resend' | 'suspend' | 'reactivate' | 'delete';
  label: string;
  destructive?: boolean;
}

// What the "⋯" menu of a managed user row holds, in order: resend first, the
// status change last (suspending in the destructive colour). An empty list
// means the row gets no menu button at all.
export function userMenuEntries(input: {
  canResend: boolean;
  statusBlocked: boolean;
  isActive: boolean;
  // Permanent delete: a suspended account the Super Admin may remove for good.
  canDelete?: boolean;
}): UserMenuEntry[] {
  const entries: UserMenuEntry[] = [];
  if (input.canResend) entries.push({ key: 'resend', label: 'ส่งคำเชิญซ้ำ' });
  if (!input.statusBlocked) {
    entries.push(
      input.isActive
        ? { key: 'suspend', label: 'ระงับการใช้งาน', destructive: true }
        : { key: 'reactivate', label: 'เปิดใช้งานอีกครั้ง' },
    );
  }
  if (input.canDelete) entries.push({ key: 'delete', label: 'ลบถาวร', destructive: true });
  return entries;
}
