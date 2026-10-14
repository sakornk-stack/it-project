'use client';

import { useState, type ReactNode } from 'react';
import type { AdminUserSummary } from '@eduanalyze-ai/shared-types';
import { resendInvitation } from '@/lib/api/user-management';
import { canResendInvitation, describeResendError } from '@/lib/resend-invitation';
import { useToast } from '@/lib/toast-context';
import { ApiErrorAlert } from '@/components/admin/api-error-alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

// Emails a fresh password-setup link to an account that has not set a password
// yet. The hook keeps the confirm dialog mounted outside whatever opens it (the
// row menu closes and unmounts), and `canResend` is false whenever the API would
// refuse, so there is never a dead action.
export function useResendInvitation({
  user,
  requesterId,
  requesterIsSuperAdmin,
  errorPlacement = 'inline',
}: Readonly<{
  user: AdminUserSummary;
  requesterId: string;
  requesterIsSuperAdmin: boolean;
  // Table rows have no room for a block under the button, so they use a toast.
  errorPlacement?: 'inline' | 'toast';
}>) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canResend = canResendInvitation({
    isSelf: user.id === requesterId,
    requesterIsSuperAdmin,
    user,
  });

  // Flow that writes: POST /users/:id/resend-invitation
  async function send() {
    setBusy(true);
    setError(null);
    try {
      await resendInvitation(user.id);
      toast.success('ส่งอีเมลแล้ว');
    } catch (err) {
      const message = describeResendError(err);
      if (errorPlacement === 'toast') toast.error(message);
      else setError(message);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  const dialog: ReactNode = (
    <ConfirmDialog
      open={confirming}
      onOpenChange={setConfirming}
      title={`ส่งคำเชิญซ้ำให้ ${user.fullName}?`}
      description={
        <>
          <p>ระบบจะส่งอีเมลลิงก์ตั้งรหัสผ่านใหม่ไปที่ {user.email}</p>
          <p className="mt-2">
            ลิงก์เดิมที่ยังไม่ได้ใช้จะใช้งานไม่ได้อีก และลิงก์ใหม่หมดอายุใน 1 ชั่วโมง
          </p>
        </>
      }
      confirmLabel="ส่งอีเมล"
      confirmVariant="default"
      busy={busy}
      onConfirm={() => void send()}
    />
  );

  return {
    canResend,
    busy,
    error,
    dismissError: () => setError(null),
    request: () => setConfirming(true),
    dialog,
  };
}

export function ResendInvitationButton(
  props: Readonly<{
    user: AdminUserSummary;
    requesterId: string;
    requesterIsSuperAdmin: boolean;
    errorPlacement?: 'inline' | 'toast';
  }>,
) {
  const resend = useResendInvitation(props);
  if (!resend.canResend) return null;

  return (
    <span className="flex w-full flex-col items-stretch gap-2 sm:inline-flex sm:w-auto sm:items-start">
      <Button
        type="button"
        variant="outline"
        className="w-full px-3 sm:w-auto"
        disabled={resend.busy}
        aria-label={`ส่งคำเชิญซ้ำให้ ${props.user.fullName}`}
        onClick={resend.request}
      >
        ส่งคำเชิญซ้ำ
      </Button>
      {resend.error && <ApiErrorAlert message={resend.error} onDismiss={resend.dismissError} />}
      {resend.dialog}
    </span>
  );
}
