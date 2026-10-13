import { useState } from 'react';
import { isAxiosError } from 'axios';
import { Mail, Plus } from 'lucide-react';
import type { StudentInvitationListEntry } from '@eduanalyze-ai/shared-types';
import { resendStudentInvitation } from '@/lib/api/staff';
import { useToast } from '@/lib/toast-context';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

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
          ? 'ไม่พบคำเชิญนี้แล้ว — อาจถูกยกเลิกหรือลงทะเบียนไปแล้ว'
          : 'ส่งคำเชิญไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
      );
    } finally {
      setResendingId(null);
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

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b-2 border-slate-200 bg-slate-50 text-xs text-muted-foreground">
              <th className="px-3 py-3 font-semibold">รหัสนิสิต</th>
              <th className="px-3 py-3 font-semibold">ชื่อ-นามสกุล</th>
              <th className="px-3 py-3 font-semibold">อีเมล</th>
              <th className="px-3 py-3 font-semibold">สาขา</th>
              <th className="px-3 py-3 font-semibold">หมดอายุ</th>
              <th className="px-3 py-3 font-semibold">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((inv) => (
              <tr key={inv.id} className="border-b border-slate-100 align-middle hover:bg-slate-50">
                <td className="px-3 py-3 font-semibold tabular-nums">{inv.studentCode}</td>
                <td className="break-words px-3 py-3">{inv.fullName}</td>
                <td className="break-all px-3 py-3 text-muted-foreground">{inv.email}</td>
                <td className="px-3 py-3">{inv.program.code}</td>
                <td className="px-3 py-3 tabular-nums">{formatExpiry(inv.expiresAt)}</td>
                <td className="px-3 py-3">{resendButton(inv)}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
            <div className="flex">{resendButton(inv)}</div>
          </li>
        ))}
      </ul>
    </>
  );
}
