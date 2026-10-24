'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ClipboardList,
  Crown,
  GraduationCap,
  LogOut,
  Menu,
  PanelLeftOpen,
  Presentation,
  ShieldCheck,
  User,
  type LucideIcon,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { RevealOnViewProvider } from '@/components/layout/reveal';
import { LoadingGate } from '@/components/ui/loading-gate';
import { isNavItemActive, navItemsForRole } from './nav-config';
import { StudentShell } from './student-shell';

// Remembered per browser; read after mount so the server render and first client
// render agree (expanded), then the saved choice applies and the width eases over.
const SIDEBAR_COLLAPSED_KEY = 'eduanalyze.sidebar-collapsed';

// Icon for each role's "switch role" link — in the icon rail a shared icon would make
// several other roles indistinguishable.
const ROLE_SWITCH_ICON: Record<Role, LucideIcon> = {
  STUDENT: GraduationCap,
  INSTRUCTOR: Presentation,
  STAFF: ClipboardList,
  ADMIN: ShieldCheck,
  SUPER_ADMIN: Crown,
};

// Tooltip for the icon rail; Radix opens it on hover and on keyboard focus.
function RailTip({
  label,
  enabled,
  children,
}: Readonly<{ label: string; enabled: boolean; children: React.ReactElement }>) {
  // Always the same element tree, so toggling the rail keeps keyboard focus on the button;
  // `open={false}` just holds the tooltip shut while the labels are visible.
  return (
    <Tooltip open={enabled ? undefined : false}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function readSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSidebarCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // Storage blocked: the choice just lasts for this visit.
  }
}

type DashboardShellProps = {
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
};

// Students get their own frame (top bar and tabs, green theme); every other role
// keeps the side menu below.
export function DashboardShell(props: DashboardShellProps) {
  return (props.role ?? 'STUDENT') === 'STUDENT' ? (
    <StudentShell {...props} />
  ) : (
    <SidebarShell {...props} />
  );
}

function SidebarShell({
  studentCode,
  identityLabel,
  fullName,
  role = 'STUDENT',
  skeleton,
  ready = true,
  children,
}: DashboardShellProps) {
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
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  // Only the fixed (>= lg) sidebar collapses; the drawer is always full width.
  // The shell only renders after the client-side auth gate, never on the server, so reading the
  // saved choice in the initializer paints the right width on the first frame (no flash).
  const [collapsed, setCollapsed] = useState(() =>
    typeof window === 'undefined' ? false : readSidebarCollapsed(),
  );

  // Crossing up to the desktop breakpoint must not leave the drawer (and its overlay and
  // scroll lock) open behind the fixed sidebar.
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = (e: MediaQueryListEvent) => {
      if (e.matches) setDrawerOpen(false);
    };
    query.addEventListener('change', closeOnDesktop);
    return () => query.removeEventListener('change', closeOnDesktop);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      writeSidebarCollapsed(!prev);
      return !prev;
    });
  };

  // A nav link inside the drawer should dismiss it, not leave it open over
  // the newly-navigated page.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Icon-only mode keeps each label as screen-reader text and shows it as a tooltip.
  const renderSidebar = (iconOnly: boolean, showToggle = false) => {
    // Every row is a fixed 48px icon cell plus a label, and the rail is 48px of content, so the
    // icons sit at the same x in both states and only the labels fade and get clipped.
    const labelClass = cn(
      'min-w-0 flex-1 overflow-hidden whitespace-nowrap pr-3 ease-in-out transition-opacity motion-reduce:transition-none',
      iconOnly ? 'opacity-0 duration-100' : 'opacity-100 delay-100 duration-150',
    );
    const iconCell = 'flex h-11 w-12 shrink-0 items-center justify-center';
    const rowBase =
      'relative flex min-h-11 items-center overflow-hidden rounded-lg text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';
    const tip = (label: string) => (iconOnly ? { 'aria-label': label } : undefined);
    const railMotion = 'ease-in-out motion-reduce:transition-none';

    return (
    <>
      <div
        className={cn(
          'relative mb-8 transition-[height] duration-[220ms]',
          railMotion,
          showToggle && iconOnly ? 'h-[6.25rem]' : 'h-11',
        )}
      >
        <div className={cn(iconCell, 'absolute left-0 top-0')}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
            <GraduationCap size={18} aria-hidden="true" className="text-brand-light" />
          </div>
        </div>
        <div
          className={cn(
            'absolute left-[3.25rem] top-0 flex h-11 flex-col justify-center whitespace-nowrap transition-opacity',
            railMotion,
            iconOnly ? 'opacity-0 duration-100' : 'opacity-100 delay-100 duration-150',
          )}
        >
          <p className="text-sm font-semibold leading-snug text-primary">EduAnalyze</p>
          <p className="text-xs leading-snug text-muted-foreground">Academic Insights</p>
        </div>
        {showToggle && (
          <RailTip label="ขยายเมนู" enabled={iconOnly}>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-expanded={!iconOnly}
              aria-controls="app-sidebar"
              aria-label={iconOnly ? 'ขยายเมนู' : 'ย่อเมนู'}
              title={iconOnly ? undefined : 'ย่อเมนู'}
              className={cn(
                'absolute left-0 top-0 flex h-11 w-12 items-center justify-center rounded-lg text-muted-foreground transition-[transform,background-color,color] duration-[220ms] hover:bg-accent hover:text-foreground active:bg-accent active:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                railMotion,
                iconOnly ? 'translate-y-14' : 'translate-x-[11.4rem]',
              )}
            >
              <Menu
                size={20}
                aria-hidden="true"
                className={cn(
                  'absolute transition-[opacity,transform] duration-200',
                  railMotion,
                  iconOnly ? 'rotate-90 opacity-0' : 'opacity-100',
                )}
              />
              <PanelLeftOpen
                size={20}
                aria-hidden="true"
                className={cn(
                  'absolute transition-[opacity,transform] duration-200',
                  railMotion,
                  iconOnly ? 'opacity-100' : '-rotate-90 opacity-0',
                )}
              />
            </button>
          </RailTip>
        )}
      </div>

      <nav aria-label="เมนูหลัก" className="flex flex-1 flex-col gap-1.5">
        {navItems.map((item) => {
          const { label, icon: Icon, href } = item;
          const active = isNavItemActive(item, pathname);

          return (
            <RailTip key={label} label={label} enabled={iconOnly}>
            <Link
              href={href}
              aria-current={active ? 'page' : undefined}
              {...tip(label)}
              className={cn(
                rowBase,
                'font-medium transition-colors',
                active
                  ? 'bg-brand-light text-brand before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-brand'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <span className={iconCell}>
                <Icon size={18} aria-hidden="true" />
              </span>
              <span className={labelClass}>{label}</span>
            </Link>
            </RailTip>
          );
        })}
      </nav>

      {otherRoles.length > 0 && (
        <div className="mb-3 flex flex-col gap-1 border-t border-border pt-4">
          <p
            className={cn(
              'overflow-hidden whitespace-nowrap px-3 text-xs font-medium text-muted-foreground transition-[max-height,opacity,padding] duration-[220ms]',
              railMotion,
              iconOnly ? 'max-h-0 pb-0 opacity-0' : 'max-h-6 pb-1 opacity-100',
            )}
          >
            สลับบทบาท
          </p>
          {otherRoles.map((otherRole) => {
            const RoleIcon = ROLE_SWITCH_ICON[otherRole];
            const switchLabel = `สลับบทบาท: ${ROLE_LABEL_TH[otherRole]}`;
            return (
            <RailTip key={otherRole} label={switchLabel} enabled={iconOnly}>
            <Link
              href={homeRouteForRole(otherRole)}
              {...tip(switchLabel)}
              className={cn(
                rowBase,
                'text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
              )}
            >
              <span className={iconCell}>
                <RoleIcon size={18} aria-hidden="true" />
              </span>
              <span className={labelClass}>{ROLE_LABEL_TH[otherRole]}</span>
            </Link>
            </RailTip>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-1 border-t border-border pt-4">
        <RailTip label="โปรไฟล์และความปลอดภัย" enabled={iconOnly}>
        <Link
          href="/profile"
          aria-current={pathname === '/profile' ? 'page' : undefined}
          {...tip('โปรไฟล์และความปลอดภัย')}
          className={cn(
            rowBase,
            'transition-colors',
            pathname === '/profile'
              ? 'bg-brand-light font-medium text-brand'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          <span className={iconCell}>
            <User size={18} aria-hidden="true" />
          </span>
          <span className={labelClass}>โปรไฟล์และความปลอดภัย</span>
        </Link>
        </RailTip>
        <RailTip label="ออกจากระบบ" enabled={iconOnly}>
        <button
          type="button"
          onClick={() => logout()}
          {...tip('ออกจากระบบ')}
          className={cn(
            rowBase,
            'text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
          )}
        >
          <span className={iconCell}>
            <LogOut size={18} aria-hidden="true" />
          </span>
          <span className={labelClass}>ออกจากระบบ</span>
        </button>
        </RailTip>
      </div>
    </>
    );
  };

  return (
    <div className="flex min-h-dvh bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary focus:shadow-md focus:outline-none focus:ring-2 focus:ring-brand"
      >
        ข้ามไปเนื้อหาหลัก
      </a>
      <aside
        id="app-sidebar"
        aria-label="เมนูด้านข้าง"
        className={cn(
          'hidden w-64 shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-border bg-card/40 px-3 py-6 transition-[width] duration-[220ms] ease-in-out motion-reduce:transition-none lg:sticky lg:top-0 lg:flex lg:h-dvh lg:self-start',
          collapsed && 'lg:w-[4.5rem]',
        )}
      >
        <TooltipProvider delayDuration={150}>{renderSidebar(collapsed, true)}</TooltipProvider>
      </aside>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          className="px-3 lg:hidden"
          // Radix would focus the first non-link control (log out); start on the current
          // menu item, or the first one, instead.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            const nav = e.currentTarget as HTMLElement;
            nav
              .querySelector<HTMLElement>('nav a[aria-current="page"], nav a')
              ?.focus();
          }}
          // No Radix trigger here, so hand focus back to the header ☰ ourselves.
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            menuButtonRef.current?.focus();
          }}
        >
          {renderSidebar(false)}
        </SheetContent>
      </Sheet>

      {/* min-w-0: as a flex item this column otherwise grows to its content's
          min-content width, so a wide table's overflow-x-auto wrapper never got
          narrower than the table and the whole page scrolled sideways. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-4 md:px-8 lg:justify-end">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
    </div>
  );
}
