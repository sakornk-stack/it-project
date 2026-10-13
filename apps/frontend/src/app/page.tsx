'use client';

import Link from 'next/link';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { GraduationCap, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { resolveHomeRoute } from '@/lib/dashboard-routes';
import { primaryRoleFor } from '@/lib/role-priority';
import { cn } from '@/lib/utils';
import { BRAND_NAME } from '@/lib/brand';
import { HOVER_LIFT } from '@/lib/motion';
import { ROLE_LABEL_TH, ROLE_BADGE_TONE } from '@/components/auth/require-role';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Reveal } from '@/components/layout/reveal';

// Intentionally not auto-redirecting authenticated users to their
// dashboard on mount — this is a hub page that shows who's logged in
// and offers an explicit "ไปที่แดชบอร์ด" action, not a silent redirect.
export default function Home() {
  const { user, status, logout } = useAuth();
  const primaryRole = user ? primaryRoleFor(user.roles) : null;

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center bg-background p-4"
      style={{
        backgroundImage:
          'radial-gradient(circle at 50% -10%, hsl(var(--brand-light)) 0%, transparent 55%)',
      }}
    >
      <ThemeToggle className="fixed right-4 top-4 z-30" />
      <div className="w-full max-w-md">
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-6">
            <Reveal index={0} className="flex flex-col items-center gap-2">
              <Skeleton className="h-14 w-14 rounded-2xl" />
              <Skeleton className="h-4 w-40" />
            </Reveal>
            <Reveal index={2} className="w-full">
              <Skeleton className="h-32 w-full rounded-lg" />
            </Reveal>
            <Reveal index={4}>
              <Skeleton className="h-10 w-48 rounded-md" />
            </Reveal>
          </div>
        )}

        {status === 'authenticated' && user && primaryRole && (
          <div className="flex flex-col items-center gap-6">
            <Reveal index={0} className="flex flex-col items-center gap-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand shadow-sm">
                <GraduationCap size={26} className="text-brand-light" />
              </div>
              <span className="text-base font-medium text-primary">{BRAND_NAME}</span>
            </Reveal>

            <Reveal index={2} className="w-full">
              <Card className="bg-gradient-to-br from-brand-light/70 via-card to-card shadow-sm">
                <CardContent className="flex flex-col items-center gap-4 p-6 text-center sm:p-7">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-xl font-bold tracking-wide text-brand-foreground shadow-sm ring-4 ring-card">
                    {user.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="mb-1 text-sm font-medium text-brand">เข้าสู่ระบบในชื่อ</p>
                    <p className="text-xl font-semibold tracking-tight text-primary">
                      {user.fullName}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
                    <Badge tone={ROLE_BADGE_TONE[primaryRole]} className="mt-3">
                      {ROLE_LABEL_TH[primaryRole]}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Reveal>

            <Reveal index={4} className="flex w-full flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className={cn('flex-1 gap-2', HOVER_LIFT)}>
                <Link href={resolveHomeRoute(user.roles)}>
                  <LayoutDashboard size={18} />
                  ไปที่แดชบอร์ด
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className={cn('flex-1', HOVER_LIFT)}
                onClick={() => logout()}
              >
                ออกจากระบบ
              </Button>
            </Reveal>
          </div>
        )}

        {status === 'unauthenticated' && (
          <div className="flex flex-col items-center gap-6 text-center">
            <Reveal index={0} className="flex flex-col items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand shadow-sm">
                <GraduationCap size={26} className="text-brand-light" />
              </div>
              <span className="text-base font-medium text-primary">{BRAND_NAME}</span>
            </Reveal>

            <Reveal index={2}>
              <h1 className="text-3xl font-semibold leading-snug tracking-tight text-primary sm:text-4xl">
                ติดตามผลการเรียน วิเคราะห์ศักยภาพ ด้วยข้อมูลจริง
              </h1>
            </Reveal>

            <Reveal index={4}>
              <p className="max-w-sm text-sm leading-relaxed text-brand sm:text-base">
                แพลตฟอร์มวิเคราะห์ข้อมูลการศึกษาที่ช่วยติดตามผลสัมฤทธิ์ CLO/PLO
                และประเมินศักยภาพความถนัดด้วย AI เพื่อสนับสนุนการเรียนรู้ของนิสิตอย่างครบวงจร
              </p>
            </Reveal>

            <Reveal index={5} className="flex gap-2">
              <span className="h-1 w-6 rounded-full bg-brand" />
              <span className="h-1 w-2 rounded-full bg-brand/40" />
              <span className="h-1 w-2 rounded-full bg-brand/40" />
            </Reveal>

            <Reveal index={7} className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild size="lg" className={cn('flex-1 sm:flex-none sm:px-8', HOVER_LIFT)}>
                <Link href="/login">เข้าสู่ระบบ</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className={cn('flex-1 sm:flex-none sm:px-8', HOVER_LIFT)}
              >
                <Link href="/register">สมัครสมาชิก</Link>
              </Button>
            </Reveal>
          </div>
        )}
      </div>
    </main>
  );
}
