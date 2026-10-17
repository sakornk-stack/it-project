'use client';

import { AlertCircle } from 'lucide-react';
import type { CurrentUserResponse } from '@eduanalyze-ai/shared-types';
import { primaryRoleFor } from '@/lib/role-priority';
import { resolveHomeRoute } from '@/lib/dashboard-routes';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AccessDenied } from '@/components/ui/access-denied';

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
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>{message}</span>
        {onRetry && (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            ลองใหม่
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
