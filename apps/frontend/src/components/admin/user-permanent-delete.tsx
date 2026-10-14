'use client';

import { useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import type { AdminUserSummary } from '@eduanalyze-ai/shared-types';
import { canPermanentlyDelete } from '@/lib/admin-user-guard';
import { deleteUserPermanently } from '@/lib/api/user-management';
import { useToast } from '@/lib/toast-context';
import { PermanentDeleteDialog } from '@/components/admin/permanent-delete-button';

const REFERENCE_PARTS = [
  ['courseInstructors', (n: number) => `ยังเป็นผู้สอน ${n} วิชา`],
  ['enteredRecords', (n: number) => `เคยบันทึกผลการเรียน ${n} รายการ`],
  ['studentInvitations', (n: number) => `เป็นผู้เชิญนิสิต ${n} รายการ`],
] as const;

// Why the list already knows the delete will be refused (same wording the API
// uses, so the box reads the same either way). null = nothing blocks it.
export function referencesBlockedReason(user: AdminUserSummary): string | null {
  const refs = user.references;
  if (!refs) return null;
  const parts = REFERENCE_PARTS.filter(([key]) => refs[key] > 0).map(([key, text]) =>
    text(refs[key]),
  );
  if (parts.length === 0) return null;
  const todo = [
    refs.courseInstructors > 0 ? 'ให้เจ้าหน้าที่ถอนการมอบหมายผู้สอนก่อน' : null,
    refs.studentInvitations > 0 ? 'รอให้คำเชิญของบัญชีนี้หมดอายุก่อน' : null,
    refs.enteredRecords > 0
      ? 'ประวัติการบันทึกผลการเรียนลบไม่ได้ จึงเก็บบัญชีนี้ไว้ในสถานะระงับ'
      : null,
  ].filter(Boolean);
  return `ลบถาวรไม่ได้: ${parts.join(', ')} (${todo.join(' · ')})`;
}

// Permanent delete of a suspended account, from the Super Admin's list or the
// detail page. The menu item that starts it lives in UserRowMenu (or a button);
// this hook keeps the dialog mounted outside it, like useUserStatusToggle.
export function useUserPermanentDelete({
  user,
  requesterId,
  requesterIsSuperAdmin,
  basePath,
  onDeleted,
}: {
  user: AdminUserSummary;
  requesterId: string;
  requesterIsSuperAdmin: boolean;
  basePath: string;
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  const canDelete = canPermanentlyDelete({
    basePath,
    requesterIsSuperAdmin,
    isSelf: user.id === requesterId,
    target: user,
  });

  const dialog: ReactNode = canDelete ? (
    <PermanentDeleteDialog
      open={open}
      onOpenChange={setOpen}
      title="ลบบัญชีนี้ถาวร?"
      confirmText={user.email}
      keepOpenOnError
      blockedReason={referencesBlockedReason(user)}
      description={
        <div className="space-y-2">
          <p>
            จะลบ {user.fullName} ออกจากระบบถาวร ได้แก่ บัญชีเข้าสู่ระบบ บทบาท ขอบเขต
            และการตั้งค่ายืนยันตัวตนสองขั้นตอน (2FA) ของบัญชีนี้
          </p>
          <p className="font-medium text-foreground">การลบนี้ย้อนกลับไม่ได้</p>
        </div>
      }
      onConfirm={async () => {
        await deleteUserPermanently(user.id);
        toast.success('ลบบัญชีถาวรแล้ว');
        await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        onDeleted?.();
      }}
    />
  ) : null;

  return { canDelete, request: () => setOpen(true), dialog };
}

// The same action on a user's own page: a red button that opens the dialog.
// Rendered only for a suspended account the viewer may delete, so a user who
// cannot be deleted never sees it. Leaving the page is the caller's `onDeleted`.
export function UserPermanentDeleteButton({
  className,
  ...props
}: Parameters<typeof useUserPermanentDelete>[0] & { className?: string }) {
  const { canDelete, request, dialog } = useUserPermanentDelete(props);
  if (!canDelete) return null;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn(
          'gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/10',
          className,
        )}
        onClick={request}
      >
        <Trash2 size={16} aria-hidden="true" />
        ลบถาวร
      </Button>
      {dialog}
    </>
  );
}
