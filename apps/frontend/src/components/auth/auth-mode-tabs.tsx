'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

// Visually the mockup's Login/Register toggle, but backed by real
// navigation — login and register are separate pages (register needs
// far more fields than a toggle-in-place form could hold), not client
// state on one shared component.
export function AuthModeTabs({ active }: { active: 'login' | 'register' }) {
  return (
    <div className="mb-6 flex rounded-lg bg-muted p-1">
      <Link
        href="/login"
        className={cn(
          'flex min-h-11 flex-1 items-center justify-center rounded-md text-center text-sm font-medium transition',
          active === 'login' ? 'bg-background text-foreground shadow-card' : 'text-muted-foreground',
        )}
      >
        เข้าสู่ระบบ
      </Link>
      <Link
        href="/register"
        className={cn(
          'flex min-h-11 flex-1 items-center justify-center rounded-md text-center text-sm font-medium transition',
          active === 'register'
            ? 'bg-background text-foreground shadow-card'
            : 'text-muted-foreground',
        )}
      >
        สมัครสมาชิก
      </Link>
    </div>
  );
}
