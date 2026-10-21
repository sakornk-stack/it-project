'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  GraduationCap,
  LogOut,
  Repeat,
  Menu,
  User,
} from 'lucide-react';
import type { Role } from '@eduanalyze-ai/shared-types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { homeRouteForRole } from '@/lib/dashboard-routes';
import { ROLE_PRIORITY } from '@/lib/role-priority';
import { PrivacyFooterLink } from '@/components/layout/privacy-footer-link';
import { ROLE_BADGE_TONE, ROLE_LABEL_TH } from '@/components/auth/require-role';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { RevealOnViewProvider } from '@/components/layout/reveal';
import { LoadingGate } from '@/components/ui/loading-gate';
import { isNavItemActive, navItemsForRole } from './nav-config';

export function DashboardShell({
  studentCode,
  identityLabel,
  fullName,
  role = 'STUDENT',
  skeleton,
  ready = true,
  children,
}: {
  studentCode?: string;
  // Generic identity label shown next to fullName in the header — use this
  // for roles that have no student-code equivalent (e.g. instructor email).
  identityLabel?: string;
  fullName: string;
  role?: Role;
  // Opt-in loading cross-fade: pass the page's skeleton on every render of the
  // page (loading and loaded) and `ready={false}` while loading, so the
  // skeleton fades out as the content appears. Omit it and nothing changes.
  skeleton?: React.ReactNode;
  ready?: boolean;
  children: React.ReactNode;
}) {
  const { logout, user } = useAuth();
  // Each page renders the shell as one role, so a multi-role account needs a
  // way over to its other roles' menus.
  const otherRoles = ROLE_PRIORITY.filter((r) => r !== role && user?.roles.includes(r));
  const pathname = usePathname();
  const navItems = navItemsForRole(role);
  const shownIdentity = identityLabel ?? studentCode;
  // A long email pushed the name and role badge off narrow phones; the email is
  // only hidden below sm. A student code is short and always shown.
  const identityIsEmail = !!shownIdentity?.includes('@');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // A nav link inside the drawer should dismiss it, not leave it open over
  // the newly-navigated page.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const sidebarContent = (
    <>
      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
          <GraduationCap size={18} aria-hidden="true" className="text-brand-light" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-snug text-primary">EduAnalyze</p>
          <p className="text-xs leading-snug text-muted-foreground">Academic Insights</p>
        </div>
      </div>

      <nav aria-label="เมนูหลัก" className="flex flex-1 flex-col gap-1.5">
        {navItems.map((item) => {
          const { label, icon: Icon, href } = item;
          const active = isNavItemActive(item, pathname);

          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                active
                  ? 'bg-brand-light text-brand before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-brand'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon size={18} aria-hidden="true" className="shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {otherRoles.length > 0 && (
        <div className="mb-3 flex flex-col gap-1 border-t border-border pt-4">
          <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">สลับบทบาท</p>
          {otherRoles.map((otherRole) => (
            <Link
              key={otherRole}
              href={homeRouteForRole(otherRole)}
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Repeat size={18} className="shrink-0" aria-hidden="true" />
              {ROLE_LABEL_TH[otherRole]}
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1 border-t border-border pt-4">
        <Link
          href="/profile"
          aria-current={pathname === '/profile' ? 'page' : undefined}
          className={cn(
            'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
            pathname === '/profile'
              ? 'bg-brand-light font-medium text-brand'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          <User size={18} className="shrink-0" aria-hidden="true" />
          โปรไฟล์และความปลอดภัย
        </Link>
        <button
          type="button"
          onClick={() => logout()}
          className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <LogOut size={18} className="shrink-0" aria-hidden="true" />
          ออกจากระบบ
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-dvh bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary focus:shadow-md focus:outline-none focus:ring-2 focus:ring-brand"
      >
        ข้ามไปเนื้อหาหลัก
      </a>
      <aside aria-label="เมนูด้านข้าง" className="hidden w-64 flex-col border-r border-border bg-card/40 p-6 md:flex">
        {sidebarContent}
      </aside>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="md:hidden">
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* min-w-0: as a flex item this column otherwise grows to its content's
          min-content width, so a wide table's overflow-x-auto wrapper never got
          narrower than the table and the whole page scrolled sideways. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-4 md:justify-end md:px-8">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-label="เปิดเมนู"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/profile"
              className="flex min-h-11 items-center gap-3 rounded-lg text-sm hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {shownIdentity && (
                <span
                  className={cn('text-muted-foreground', identityIsEmail && 'hidden sm:inline')}
                >
                  {shownIdentity}
                </span>
              )}
              <span className="font-medium text-primary">{fullName}</span>
              <Badge tone={ROLE_BADGE_TONE[role]}>{ROLE_LABEL_TH[role]}</Badge>
            </Link>
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl flex-1 space-y-8 p-4 pb-24 focus:outline-none md:p-8 md:pb-24"
        >
          <RevealOnViewProvider>
            {skeleton ? (
              <LoadingGate ready={ready} skeleton={skeleton}>
                {children}
              </LoadingGate>
            ) : (
              children
            )}
          </RevealOnViewProvider>
          <PrivacyFooterLink className="pt-6" />
        </main>
      </div>
    </div>
  );
}
