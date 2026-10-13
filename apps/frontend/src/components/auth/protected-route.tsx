'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { NEXT_PARAM } from '@/lib/safe-next-path';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthSplitLayout } from './auth-split-layout';
import { ChangePasswordForm } from './change-password-form';

// Client-side gate only — reuses AuthContext's status (already populated
// by the silent refresh-on-mount built in F1), no middleware. Consistent
// with the access-token-never-in-a-cookie design: middleware can't
// inspect it anyway, so there's nothing a server-side check could add
// here that the client doesn't already resolve via /auth/refresh.
//
// Also the single choke point for the forced-password-change gate: every
// authenticated page renders through here, so checking
// user.mustChangePassword once — instead of a redirect to a dedicated
// route — covers every deep link and reload automatically. The real
// enforcement is on the backend (JwtAuthGuard); this is just so a blocked
// user sees a form instead of a page that 403s underneath them.
// Forced password-change gate — keeps the generic welcome copy this panel
// showed before brand copy became per-page.
const BRAND_COPY = {
  title: 'ยินดีต้อนรับสู่พื้นที่เรียนรู้ที่ใช่สำหรับคุณ',
  description:
    'เข้าถึงระบบติดตามผลการเรียนที่ครอบคลุม การวิเคราะห์ CLO/PLO และการวิเคราะห์ศักยภาพความถนัด เพื่อขับเคลื่อนความสำเร็จของนิสิต',
};

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { status, user, signedOut, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // window.location.search rather than useSearchParams, which would force a
  // Suspense boundary onto every protected page. replace, so Back from the
  // login form doesn't land on this protected URL again.
  useEffect(() => {
    if (status === 'unauthenticated') {
      if (signedOut) {
        router.replace('/login');
        return;
      }
      const next = `${pathname}${window.location.search}`;
      router.replace(`/login?${NEXT_PARAM}=${encodeURIComponent(next)}`);
    }
  }, [status, signedOut, router, pathname]);

  if (status === 'loading') {
    // Fires before the page shell (sidebar/topbar) mounts — the shell needs
    // a resolved user, so there's no real layout to mimic yet. A small
    // centered mark, not a page-shaped skeleton, is the honest choice here.
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-3">
          <Skeleton className="mx-auto h-10 w-10 rounded-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  if (user?.mustChangePassword) {
    return (
      <AuthSplitLayout {...BRAND_COPY}>
        <div className="space-y-4">
          <ChangePasswordForm
            title="ตั้งรหัสผ่านใหม่"
            description="บัญชีนี้ยังใช้รหัสผ่านชั่วคราวอยู่ กรุณาตั้งรหัสผ่านใหม่ก่อนใช้งานต่อ"
          />
          <Button type="button" variant="ghost" size="sm" className="w-full" onClick={logout}>
            ออกจากระบบ
          </Button>
        </div>
      </AuthSplitLayout>
    );
  }

  return <>{children}</>;
}
