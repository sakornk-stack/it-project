'use client';

import { useState, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { AdminUserSummary } from '@eduanalyze-ai/shared-types';
import { suspendBlockReason } from '@/lib/admin-user-guard';
import { updateUserActiveStatus } from '@/lib/api/user-management';
import { describeApiError } from '@/lib/describe-api-error';
import { useToast } from '@/lib/toast-context';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Suspend or reactivate straight from the Super Admin's list. Suspending asks
// first; reactivating is one click. The menu item that starts it lives in
// UserRowMenu, while this hook keeps the dialog mounted outside the menu (the
// menu unmounts as soon as it closes).
export function useUserStatusToggle(user: AdminUserSummary, requesterId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const blockReason = suspendBlockReason({
    isSelf: user.id === requesterId,
    requesterIsSuperAdmin: true,
    targetRoles: user.roles,
    targetScopes: user.scopes,
    ownScopes: null,
    org: null,
  });

  async function toggle() {
    setBusy(true);
    try {
      await updateUserActiveStatus(user.id, { isActive: !user.isActive });
      toast.success(user.isActive ? 'ระงับการใช้งานบัญชีแล้ว' : 'เปิดใช้งานบัญชีอีกครั้งแล้ว');
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (error) {
      toast.error(describeApiError(error));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  const dialog: ReactNode = (
    <ConfirmDialog
      open={confirming}
      onOpenChange={setConfirming}
      title={`ระงับบัญชีของ ${user.fullName}?`}
      description={
        <>
          <p>
            {user.fullName} ({user.email}) จะเข้าสู่ระบบไม่ได้ทันที
            และเซสชันที่ใช้งานอยู่จะใช้งานต่อไม่ได้
          </p>
          <p className="mt-2">เปิดใช้งานอีกครั้งได้ภายหลังจากหน้านี้</p>
        </>
      }
      confirmLabel="ระงับบัญชี"
      busy={busy}
      onConfirm={() => void toggle()}
    />
  );

  return {
    blockReason,
    busy,
    // Suspending is confirmed; reactivating is not.
    request: () => (user.isActive ? setConfirming(true) : void toggle()),
    dialog,
  };
}

// Shown instead of any status action when the rules forbid it, so a locked
// account is never a button that does nothing: a small lock whose tooltip gives
// the real reason.
export function UserManageBlocked({
  reason,
  showReason = false,
}: Readonly<{
  reason: string;
  // Cards have room to write the reason out (and no hover on a phone); table rows
  // keep it in a tooltip.
  showReason?: boolean;
}>) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 before:absolute before:-inset-1 before:content-[''] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Lock size={16} aria-hidden="true" />
            {!showReason && <span className="sr-only">{reason}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{reason}</TooltipContent>
      </Tooltip>
      {showReason && <span className="text-xs text-muted-foreground">{reason}</span>}
    </span>
  );
}
