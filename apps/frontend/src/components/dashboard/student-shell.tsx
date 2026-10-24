'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GraduationCap, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { homeRouteForRole } from '@/lib/dashboard-routes';
import { ROLE_PRIORITY } from '@/lib/role-priority';
import { PrivacyFooterLink } from '@/components/layout/privacy-footer-link';
import { ROLE_LABEL_TH } from '@/components/auth/require-role';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { RevealOnViewProvider } from '@/components/layout/reveal';
import { LoadingGate } from '@/components/ui/loading-gate';
import { isNavItemActive, navItemsForRole } from './nav-config';

// The student app's frame: a green top bar and a tab row instead of the side
// menu the staff roles use, plus the student theme (green, Anuphan, rounder
// cards) switched on for the whole document while a student page is open.
// The tab row scrolls sideways on a phone, so there is no drawer to open.

const THEME_CLASS = 'theme-student';

// Layout effect: the class lands before the first paint, so the page never
// flashes the staff colours. Removed on leaving (a multi-role user switching
// to a staff page gets the default theme back).
function useStudentTheme() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add(THEME_CLASS);
    return () => root.classList.remove(THEME_CLASS);
  }, []);
}

export function StudentShell({
  studentCode,
  identityLabel,
  fullName,
  skeleton,
  ready = true,
  children,
}: Readonly<{
  studentCode?: string;
  identityLabel?: string;
  fullName: string;
  skeleton?: React.ReactNode;
  ready?: boolean;
  children: React.ReactNode;
}>) {
  useStudentTheme();
  const { logout, user } = useAuth();
  const pathname = usePathname();
  const navItems = navItemsForRole('STUDENT');
  const otherRoles = ROLE_PRIORITY.filter((r) => r !== 'STUDENT' && user?.roles.includes(r));
  const shownIdentity = identityLabel ?? studentCode;
  const activeTabRef = useRef<HTMLAnchorElement>(null);

  // On a phone the tab row is wider than the screen: keep the current tab in view.
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary focus:shadow-md focus:outline-none focus:ring-2 focus:ring-brand"
      >
        ข้ามไปเนื้อหาหลัก
      </a>

      <header className="sticky top-0 z-30 shadow-sm">
        {/* Fixed greens (not theme tokens): the bar stays dark green with white
            text in both light and dark mode. */}
        <div className="bg-gradient-to-r from-[#053f39] via-[#06554c] to-[#0a7464] text-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 md:px-8">
            <Link
              href="/dashboard"
              className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                <GraduationCap size={20} aria-hidden="true" />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-base font-semibold">EduAnalyze</span>
                <span className="block truncate text-xs text-white/75">สำหรับนิสิต</span>
              </span>
            </Link>

            <div className="flex items-center gap-1 sm:gap-2">
              {otherRoles.map((role) => (
                <Link
                  key={role}
                  href={homeRouteForRole(role)}
                  className="hidden min-h-11 items-center rounded-lg px-3 text-xs text-white/85 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:flex"
                >
                  สลับเป็น{ROLE_LABEL_TH[role]}
                </Link>
              ))}
              <ThemeToggle className="text-white/85 hover:bg-white/10 hover:text-white focus-visible:ring-white" />
              <Link
                href="/profile"
                aria-current={pathname === '/profile' ? 'page' : undefined}
                className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-sm font-semibold text-[#06554c]">
                  {fullName.trim().charAt(0) || '?'}
                </span>
                <span className="hidden text-left leading-tight md:block">
                  <span className="block font-medium">{fullName}</span>
                  {shownIdentity && (
                    <span className="block text-xs text-white/75">{shownIdentity}</span>
                  )}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => logout()}
                aria-label="ออกจากระบบ"
                title="ออกจากระบบ"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-white/85 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <nav aria-label="เมนูหลัก" className="border-b border-border bg-card/95 backdrop-blur">
          <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 md:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {navItems.map((item) => {
              const { label, icon: Icon, href } = item;
              const active = isNavItemActive(item, pathname);
              return (
                <li key={href} className="shrink-0">
                  <Link
                    ref={active ? activeTabRef : undefined}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-12 items-center gap-2 whitespace-nowrap border-b-[3px] px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand',
                      active
                        ? 'border-brand text-brand'
                        : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
                    )}
                  >
                    <Icon size={17} aria-hidden="true" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 p-4 pb-2 focus:outline-none md:p-8 md:pb-2"
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
        <PrivacyFooterLink className="mt-auto" />
      </main>
    </div>
  );
}
