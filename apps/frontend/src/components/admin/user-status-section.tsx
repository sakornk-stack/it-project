'use client';

import { TriangleAlert, UserCog } from 'lucide-react';
import type { AdminUserSummary } from '@eduanalyze-ai/shared-types';
import { canPermanentlyDelete } from '@/lib/admin-user-guard';
import { canResendInvitation } from '@/lib/resend-invitation';
import { DetailSectionHeader } from '@/components/admin/detail-section-header';
import { ResendInvitationButton } from '@/components/admin/resend-invitation-button';
import { UserPermanentDeleteButton } from '@/components/admin/user-permanent-delete';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// Account status controls: suspend / reactivate, a fresh password-setup link,
// and (Super Admin, suspended accounts only) permanent delete in a danger zone.
// Every rule and handler is passed in or read from the shared guards; this only
// lays them out.
export function UserStatusSection({
  user,
  requesterId,
  requesterIsSuperAdmin,
  suspendBlocked,
  busy,
  onToggleActive,
}: Readonly<{
  user: AdminUserSummary;
  requesterId: string;
  requesterIsSuperAdmin: boolean;
  // Why the status button is withheld, or null when it is offered.
  suspendBlocked: string | null;
  busy: boolean;
  onToggleActive: () => void;
}>) {
  const isSelf = user.id === requesterId;
  const canResend = canResendInvitation({ isSelf, requesterIsSuperAdmin, user });

  return (
    <Card>
      <DetailSectionHeader icon={UserCog} title="การจัดการสถานะบัญชี" />
      <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
        <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
          <p className="text-sm font-medium">
            {user.isActive
              ? 'บัญชีนี้เข้าสู่ระบบได้ตามปกติ'
              : 'บัญชีนี้ถูกระงับ ไม่สามารถเข้าสู่ระบบได้'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {suspendBlocked ? (
              <span className="text-xs text-muted-foreground" role="note">
                เปลี่ยนสถานะบัญชีนี้ไม่ได้ — ดูเหตุผลที่การ์ด &ldquo;สิทธิ์ของคุณกับบัญชีนี้&rdquo;
              </span>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                disabled={busy}
                onClick={onToggleActive}
              >
                {user.isActive ? 'ระงับการใช้งาน' : 'เปิดใช้งานอีกครั้ง'}
              </Button>
            )}
          </div>
        </div>

        {canResend && (
          <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
            <p className="text-sm font-medium">คำเชิญตั้งรหัสผ่าน</p>
            <p className="text-sm text-muted-foreground">
              ผู้ใช้นี้ยังไม่ได้ตั้งรหัสผ่าน หากยังไม่ได้รับอีเมลหรือลิงก์หมดอายุ
              ส่งลิงก์ตั้งรหัสผ่านใหม่ได้ที่นี่
            </p>
            <ResendInvitationButton
              user={user}
              requesterId={requesterId}
              requesterIsSuperAdmin={requesterIsSuperAdmin}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Permanent delete of a suspended account (Super Admin only), in a card of its own so a
// phone can put it last, after everything else on the page. Renders nothing when the
// viewer may not delete this account.
export function UserDangerZone({
  user,
  requesterId,
  requesterIsSuperAdmin,
  basePath,
  onDeleted,
}: Readonly<{
  user: AdminUserSummary;
  requesterId: string;
  requesterIsSuperAdmin: boolean;
  basePath: string;
  onDeleted: () => void;
}>) {
  const isSelf = user.id === requesterId;
  if (!canPermanentlyDelete({ basePath, requesterIsSuperAdmin, isSelf, target: user })) return null;
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="space-y-3 p-4 sm:p-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <TriangleAlert size={16} aria-hidden="true" />
          โซนอันตราย
        </p>
        <p className="text-sm text-muted-foreground">การลบบัญชีนี้ออกจากระบบถาวรย้อนกลับไม่ได้</p>
        <UserPermanentDeleteButton
          user={user}
          requesterId={requesterId}
          requesterIsSuperAdmin={requesterIsSuperAdmin}
          basePath={basePath}
          onDeleted={onDeleted}
          className="w-full sm:w-auto"
        />
      </CardContent>
    </Card>
  );
}
