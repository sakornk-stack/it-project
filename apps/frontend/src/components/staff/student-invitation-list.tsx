import { useState } from 'react';
import { isAxiosError } from 'axios';
import { Mail, Plus, XCircle } from 'lucide-react';
import type { StudentInvitationListEntry } from '@eduanalyze-ai/shared-types';
import { cancelStudentInvitation, resendStudentInvitation } from '@/lib/api/staff';
import { useToast } from '@/lib/toast-context';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';

const INVITATION_GONE_MESSAGE = 'ไม่พบคำเชิญนี้แล้ว — อาจถูกยกเลิกหรือลงทะเบียนไปแล้ว';

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function StudentInvitationList({
  invitations,
  onChanged,
  onInviteClick,
}: Readonly<{
  invitations: StudentInvitationListEntry[];
  onChanged: () => void;
  onInviteClick?: () => void;
}>) {
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<StudentInvitationListEntry | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const toast = useToast();

  // Flow that writes: re-sends a real invitation email.
  async function handleResend(id: string, email: string) {
    setResendingId(id);
    try {
      await resendStudentInvitation(id);
      toast.success(`ส่งคำเชิญให้ ${email} อีกครั้งแล้ว`);
      onChanged();
    } catch (error) {
      toast.error(
        isAxiosError(error) && error.response?.status === 404
          ? INVITATION_GONE_MESSAGE
          : 'ส่งคำเชิญไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
      );
    } finally {
      setResendingId(null);
    }
  }

  // Flow that writes: deletes the invitation, so its link stops working.
  async function handleCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelStudentInvitation(cancelTarget.id);
      toast.success(`ยกเลิกคำเชิญของ ${cancelTarget.studentCode} แล้ว`);
      setCancelTarget(null);
      onChanged();
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        toast.error(INVITATION_GONE_MESSAGE);
        setCancelTarget(null);
        onChanged();
      } else {
        toast.error('ยกเลิกคำเชิญไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setCancelling(false);
    }
  }

  if (invitations.length === 0) {
    return (
      <EmptyState
        illustration="no-data"
        description="ยังไม่มีคำเชิญที่ค้างอยู่"
        action={
          onInviteClick && (
            <Button
              type="button"
              variant="outline"
              className="gap-1.5 px-4"
              onClick={onInviteClick}
            >
              <Plus size={16} />
              เชิญนิสิต
            </Button>
          )
        }
      />
    );
  }

  const resendButton = (inv: StudentInvitationListEntry) => (
    <Button
      type="button"
      variant="outline"
      className="gap-1.5 px-3"
      disabled={resendingId === inv.id}
      onClick={() => handleResend(inv.id, inv.email)}
    >
      <Mail aria-hidden="true" className="h-4 w-4" />
      {resendingId === inv.id ? 'กำลังส่ง...' : 'ส่งอีกครั้ง'}
      <span className="sr-only"> ให้ {inv.email}</span>
    </Button>
  );

  const cancelButton = (inv: StudentInvitationListEntry) => (
    <Button
      type="button"
      variant="outline"
      className="gap-1.5 px-3 text-destructive hover:text-destructive"
      disabled={cancelling && cancelTarget?.id === inv.id}
      onClick={() => setCancelTarget(inv)}
    >
      <XCircle aria-hidden="true" className="h-4 w-4" />
      ยกเลิกคำเชิญ
      <span className="sr-only"> ของ {inv.studentCode}</span>
    </Button>
  );

  const actions = (inv: StudentInvitationListEntry) => (
    <div className="flex flex-wrap gap-2">
      {resendButton(inv)}
      {cancelButton(inv)}
    </div>
  );

  return (
    <>
      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="ยกเลิกคำเชิญนี้?"
        description={
          cancelTarget && (
            <div className="space-y-2">
              <p>
                <span className="font-semibold tabular-nums">{cancelTarget.studentCode}</span> ·{' '}
                <span className="break-all">{cancelTarget.email}</span>
              </p>
              <p>ลิงก์ในอีเมลเชิญจะใช้สมัครไม่ได้ทันที ถ้าต้องการเชิญใหม่ต้องส่งคำเชิญอีกครั้ง</p>
            </div>
          )
        }
        confirmLabel="ยกเลิกคำเชิญ"
        cancelLabel="ไม่ยกเลิก"
        busy={cancelling}
        onConfirm={handleCancel}
      />
      <div className="hidden md:block">
        <DataTable>
          <thead>
            <tr>
              <th>รหัสนิสิต</th>
              <th>ชื่อ-นามสกุล</th>
              <th>อีเมล</th>
              <th>สาขา</th>
              <th>หมดอายุ</th>
              <th>การดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((inv) => (
              <tr key={inv.id} className="border-b border-slate-100 align-middle hover:bg-slate-50">
                <td className="font-semibold tabular-nums">{inv.studentCode}</td>
                <td className="break-words">{inv.fullName}</td>
                <td className="break-all text-muted-foreground">{inv.email}</td>
                <td>{inv.program.code}</td>
                <td className="tabular-nums">{formatExpiry(inv.expiresAt)}</td>
                <td>{actions(inv)}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>

      <ul className="space-y-3 md:hidden">
        {invitations.map((inv) => (
          <li key={inv.id} className="space-y-3 rounded-lg border border-slate-200 bg-card p-4">
            <div>
              <p className="font-semibold tabular-nums">{inv.studentCode}</p>
              <p className="break-words">{inv.fullName}</p>
              <p className="break-all text-sm text-muted-foreground">{inv.email}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">สาขา</dt>
                <dd>{inv.program.code}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">หมดอายุ</dt>
                <dd className="tabular-nums">{formatExpiry(inv.expiresAt)}</dd>
              </div>
            </dl>
            {actions(inv)}
          </li>
        ))}
      </ul>
    </>
  );
}
