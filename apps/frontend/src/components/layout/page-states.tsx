'use client';

import { AlertCircle } from 'lucide-react';
import type { CurrentUserResponse } from '@eduanalyze-ai/shared-types';
import { primaryRoleFor } from '@/lib/role-priority';
import { resolveHomeRoute } from '@/lib/dashboard-routes';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { Button } from '@/components/ui/button';
import { AccessDenied } from '@/components/ui/access-denied';
import { StateBlock } from '@/components/ui/empty-state';

// The one "no access" page: the viewer's own shell (menu, header) around AccessDenied, so a
// wrong-role visitor keeps their navigation and a way out. Used by every role's layout guard.
export function AccessDeniedPage({
  user,
  description,
}: Readonly<{ user: CurrentUserResponse; description: React.ReactNode }>) {
  return (
    <DashboardShell
      role={primaryRoleFor(user.roles)}
      identityLabel={user.email}
      fullName={user.fullName}
    >
      <AccessDenied description={description} homeHref={resolveHomeRoute(user.roles)} />
    </DashboardShell>
  );
}

export function PageLoadError({
  message = 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="rounded-xl border border-border bg-card shadow-card">
      <StateBlock
        icon={AlertCircle}
        tone="danger"
        title="โหลดข้อมูลไม่สำเร็จ"
        description={message}
        action={
          onRetry && (
            <Button type="button" variant="outline" onClick={onRetry}>
              ลองใหม่
            </Button>
          )
        }
      />
    </div>
  );
}
