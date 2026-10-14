'use client';

import { usePathname } from 'next/navigation';
import { getAccessToken, refreshAccessToken } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { isPublicPath } from '@/lib/safe-next-path';
import { SESSION_TIMEOUT_CONFIG } from '@/lib/session-timeout-config';
import { decodeAuthTimeMs } from '@/lib/session-token';
import { useIdleTimeout } from '@/lib/use-idle-timeout';
import { SessionTimeoutDialog } from './session-timeout-dialog';

// Mounted once in the root layout, so every role and every protected page is
// covered without touching individual pages (student/instructor/staff pages
// have no shared layout of their own). Idle until someone is signed in, and
// off on public pages (landing, login, register, password reset).
//
// This is UX, not enforcement: the backend still enforces the 15 min access
// token, the refresh cookie lifetime and the absolute session cap on
// /auth/refresh. It exists so the user gets a warning and a clean sign-out
// instead of a surprise 401.
export function SessionTimeoutGuard() {
  const { status, endSession } = useAuth();
  const pathname = usePathname();
  const enabled = status === 'authenticated' && !isPublicPath(pathname);

  const { snapshot, extend } = useIdleTimeout({
    enabled,
    // The same single-flight refresh the 401 interceptor uses. If it fails
    // the machine ends the session as 'refresh-failed' — never a fake success.
    extend: async () => {
      await refreshAccessToken();
    },
    getAuthTimeMs: () => decodeAuthTimeMs(getAccessToken()),
    onEnd: (reason, { remote }) => {
      void endSession(reason, { remote });
    },
  });

  if (!enabled || snapshot.phase !== 'warning') return null;

  return (
    <SessionTimeoutDialog
      remainingSeconds={snapshot.remainingSeconds}
      totalSeconds={Math.round(SESSION_TIMEOUT_CONFIG.warningMs / 1000)}
      canExtend={snapshot.canExtend}
      extending={snapshot.extending}
      onExtend={() => void extend()}
      onLogout={() => void endSession('logout')}
    />
  );
}
