'use client';

import { AlertCircle, Lock } from 'lucide-react';
import type { CurrentUserResponse } from '@eduanalyze-ai/shared-types';
import { primaryRoleFor } from '@/components/auth/require-role';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

// Rendered inside the shell with the viewer's own role, so a non-student who
// lands on a student page still has their nav and a way out.
export function StudentOnlyPage({ user }: { user: CurrentUserResponse }) {
  return (
    <DashboardShell
      role={primaryRoleFor(user.roles)}
      identityLabel={user.email}
      fullName={user.fullName}
    >
      <EmptyState icon={Lock} description="หน้านี้สำหรับนิสิตเท่านั้น" />
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
