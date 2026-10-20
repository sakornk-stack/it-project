'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, SearchX, UsersRound } from 'lucide-react';
import type { AdminUserSummary, Role } from '@eduanalyze-ai/shared-types';
import { compareUsersDefault, formatLastLogin, formatThaiDate } from '@/lib/admin-users';
import { accountStatus } from '@/lib/account-status';
import { SCOPE_LEVEL_LABELS } from '@/lib/scope-labels';
import { usePagination } from '@/lib/use-pagination';
import type { UserFiltersControl } from '@/lib/use-user-filters';
import { useScopeTargetName } from '@/lib/use-scope-target-name';
import { filterUsers, isFiltering } from '@/lib/user-list-filter';
import { roleNeedsScope } from '@/lib/user-scope-requirement';
import { useTableSort } from '@/lib/use-table-sort';
import { ROLE_BADGE_TONE, ROLE_LABEL_TH, primaryRoleFor } from '@/components/auth/require-role';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { Pagination } from '@/components/ui/pagination';
import { SortHeader } from '@/components/ui/sort-header';
import { useResendInvitation } from '@/components/admin/resend-invitation-button';
import { UserListFilters } from '@/components/admin/user-list-filters';
import { UserRowMenu } from '@/components/admin/user-row-menu';
import { useUserPermanentDelete } from '@/components/admin/user-permanent-delete';
import { UserManageBlocked, useUserStatusToggle } from '@/components/admin/user-status-action';
import { userMenuEntries } from '@/lib/user-row-actions';
import { BADGE_TONE_CLASSES, BAR_TONE_CLASSES, type SemanticTone } from '@/lib/tone';
import { cn } from '@/lib/utils';

// Header cells stay in view while the page scrolls past a long list. Above the row
// buttons (z-10) so a button never paints over the header.
const TH = 'sticky top-0 z-20 bg-slate-50 px-3 py-3';

// The avatar takes the colour of the person's top role, from the same tones as the
// role badges, so it follows the theme.
const AVATAR_TONE_CLASSES: Record<SemanticTone, string> = {
  success: BADGE_TONE_CLASSES.success,
  warning: BADGE_TONE_CLASSES.warning,
  danger: BADGE_TONE_CLASSES.danger,
  neutral: BADGE_TONE_CLASSES.neutral,
};

// One badge per account so every row is the same height. The dot pulses only for an
// account that is fully live; the wording carries the meaning, the dot only repeats it.
// Keeps the list's own tones: a suspended account is grey, not red.
function StatusColumn({ user }: Readonly<{ user: AdminUserSummary }>) {
  const { tone: detailTone, label, live } = accountStatus(user);
  const tone: SemanticTone = detailTone === 'danger' ? 'neutral' : detailTone;
  const text = live ? 'ใช้งานอยู่' : label;
  return (
    <Badge tone={tone} className="gap-1.5 whitespace-nowrap">
      <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
        {live && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:animate-none',
              BAR_TONE_CLASSES[tone],
            )}
          />
        )}
        <span
          className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', BAR_TONE_CLASSES[tone])}
        />
      </span>
      {text}
    </Badge>
  );
}

function RoleBadges({ roles }: Readonly<{ roles: Role[] }>) {
  if (roles.length === 0) return <span className="text-muted-foreground">ไม่ระบุบทบาท</span>;
  return (
    <>
      {roles.map((role) => (
        <Badge key={role} tone={ROLE_BADGE_TONE[role]}>
          {ROLE_LABEL_TH[role]}
        </Badge>
      ))}
    </>
  );
}

// Scope: a small muted level ("สาขา") then the name in regular weight, one line each,
// cut with an ellipsis (the full text is the tooltip).
function ScopeBadges({
  user,
  resolveTargetName,
  limit,
}: Readonly<{
  user: AdminUserSummary;
  resolveTargetName: ReturnType<typeof useScopeTargetName>;
  // Table rows keep a fixed height by showing the first few and counting the rest.
  limit?: number;
}>) {
  if (user.roles.includes('SUPER_ADMIN')) {
    return <Badge tone="neutral">ทั้งระบบ</Badge>;
  }
  if (user.scopes.length === 0) {
    return (
      <Badge
        tone={roleNeedsScope(user.roles) ? 'warning' : 'neutral'}
        className="whitespace-normal text-left"
      >
        ยังไม่กำหนดขอบเขต
      </Badge>
    );
  }
  const shown = limit ? user.scopes.slice(0, limit) : user.scopes;
  const hidden = user.scopes.length - shown.length;
  return (
    <ul className="space-y-1">
      {shown.map((scope) => {
        const level = SCOPE_LEVEL_LABELS[scope.level];
        const name = resolveTargetName(scope);
        return (
          <li
            key={scope.id}
            title={`${level} ${name}`}
            className="flex min-w-0 items-baseline gap-1.5 text-sm leading-snug"
          >
            <span className="shrink-0 text-xs text-muted-foreground">{level}</span>
            <span className="truncate">{name}</span>
          </li>
        );
      })}
      {hidden > 0 && <li className="text-xs text-muted-foreground">และอีก {hidden} ขอบเขต</li>}
    </ul>
  );
}

// Name first (strong), email under it (muted), "(คุณ)" as a small tag after the name
// rather than part of it. The name is the row's keyboard entry: a real link, so Enter
// opens it; the rest of the row opens it with a click (see rowClick).
function UserIdentity({
  user,
  href,
  isSelf,
}: Readonly<{ user: AdminUserSummary; href: string; isSelf: boolean }>) {
  const tone = ROLE_BADGE_TONE[primaryRoleFor(user.roles)];
  return (
    <span className="flex min-w-0 items-center gap-3">
      <InitialsAvatar
        name={user.fullName}
        className={cn('h-9 w-9 text-sm', AVATAR_TONE_CLASSES[tone])}
      />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <Link
            href={href}
            title={user.fullName}
            aria-label={`ดูรายละเอียดของ ${user.fullName}${isSelf ? ' (คุณ)' : ''}`}
            onClick={(event) => event.stopPropagation()}
            className="min-w-0 truncate rounded-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {user.fullName}
          </Link>
          {isSelf && <span className="shrink-0 text-xs text-muted-foreground">(คุณ)</span>}
        </span>
        <span title={user.email} className="block truncate text-xs text-muted-foreground">
          {user.email}
        </span>
      </span>
    </span>
  );
}

// The decorative end of a row: an arrow that slides in on hover/focus (always shown on
// touch). Clicks on it fall through to the row.
function GoArrow() {
  return (
    <span
      aria-hidden="true"
      className="go-arrow flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground"
    >
      <ArrowRight size={16} />
    </span>
  );
}

// An Admin only opens the detail page, so the row shows just the arrow (the row click
// does the work); a Super Admin also gets a lock (when the rules forbid managing the
// account) or the "⋯" menu (view, edit, resend, suspend).
function RowActions({
  href,
  user,
  basePath,
  superAdminId,
  showReason = false,
}: Readonly<{
  href: string;
  user: AdminUserSummary;
  basePath: string;
  superAdminId?: string;
  showReason?: boolean;
}>) {
  return (
    <div className="flex items-center gap-1 xl:justify-end">
      {superAdminId && (
        <SuperAdminRowActions
          href={href}
          basePath={basePath}
          user={user}
          superAdminId={superAdminId}
          showReason={showReason}
        />
      )}
      <GoArrow />
    </div>
  );
}

function SuperAdminRowActions({
  href,
  basePath,
  user,
  superAdminId,
  showReason,
}: Readonly<{
  href: string;
  basePath: string;
  user: AdminUserSummary;
  superAdminId: string;
  showReason: boolean;
}>) {
  const router = useRouter();
  const status = useUserStatusToggle(user, superAdminId);
  const resend = useResendInvitation({
    user,
    requesterId: superAdminId,
    requesterIsSuperAdmin: true,
    errorPlacement: 'toast',
  });
  // Other Super Admins and your own account cannot be edited or suspended here.
  const locked = user.roles.includes('SUPER_ADMIN');

  const remove = useUserPermanentDelete({
    user,
    requesterId: superAdminId,
    requesterIsSuperAdmin: true,
    basePath,
  });

  const open = () => router.push(href);
  const actions = {
    view: open,
    edit: open,
    resend: resend.request,
    suspend: status.request,
    reactivate: status.request,
    delete: remove.request,
  };
  const entries = userMenuEntries({
    canOpen: true,
    canEdit: !locked,
    canResend: resend.canResend,
    statusBlocked: status.blockReason !== null,
    isActive: user.isActive,
    canDelete: remove.canDelete,
  });
  // "view" alone is what the row click already does, so a row with nothing to manage
  // gets the lock instead of a menu.
  const menuItems = entries.some((entry) => entry.key !== 'view')
    ? entries.map((entry) => ({
        ...entry,
        onSelect: actions[entry.key],
        disabled: status.busy || resend.busy,
      }))
    : [];

  return (
    // The menu's items and the dialogs below render inside this wrapper (in the React
    // tree), so it also keeps their clicks from reaching the row.
    <div
      role="presentation"
      className="flex items-center gap-1"
      onClick={(event) => event.stopPropagation()}
    >
      {status.blockReason && (
        <UserManageBlocked reason={status.blockReason} showReason={showReason} />
      )}
      <UserRowMenu userName={user.fullName} items={menuItems} />
      {status.dialog}
      {resend.dialog}
      {remove.dialog}
    </div>
  );
}

// Click anywhere on the row to open the person, unless the click ended a text selection.
function rowClick(router: ReturnType<typeof useRouter>, href: string) {
  return () => {
    if (window.getSelection()?.toString()) return;
    router.push(href);
  };
}

// Keyboard twin of rowClick for the card itself; keys pressed on the link or menu inside
// are theirs, so only Enter/Space with the card focused opens the person.
function rowKeyDown(router: ReturnType<typeof useRouter>, href: string) {
  return (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    router.push(href);
  };
}

export function UserListTable({
  basePath,
  users,
  superAdminId,
  currentUserId,
  control,
}: {
  // Route tree the detail links point into: /admin or /superadmin.
  basePath: string;
  users: AdminUserSummary[];
  // Set only for a Super Admin: turns on editing and suspending from each row.
  superAdminId?: string;
  // The signed-in account, so its own row can say "(คุณ)".
  currentUserId?: string;
  // Filter state, owned by the page so the stat cards can drive it too.
  control: UserFiltersControl;
}) {
  const router = useRouter();
  const resolveTargetName = useScopeTargetName();
  const { filters, update, clear } = control;

  const filtered = useMemo(() => filterUsers(users, filters), [users, filters]);
  const isFiltered = isFiltering(filters);

  const hrefOf = (user: AdminUserSummary) => `${basePath}/users/${user.id}`;

  const ordered = useMemo(() => [...filtered].sort(compareUsersDefault), [filtered]);
  const sort = useTableSort(ordered, {
    fullName: (u) => u.fullName,
    status: (u) => (u.isActive ? 0 : 1),
  });
  const pagination = usePagination(
    sort.sorted,
    undefined,
    `${sort.sortKey}|${sort.direction}|${filters.search.trim()}|${filters.role}|${filters.status}|${filters.scope}`,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>รายชื่อผู้ใช้งาน</CardTitle>
      </CardHeader>
      <CardContent>
        <UserListFilters
          filters={filters}
          onChange={update}
          onClear={clear}
          isFiltered={isFiltered}
          shown={filtered.length}
          total={users.length}
        />
        {filtered.length === 0 ? (
          users.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              description="ยังไม่มีผู้ใช้งานในขอบเขตของคุณ กด “เพิ่มผู้ใช้งาน” ที่มุมบนเพื่อสร้างบัญชีแรก"
            />
          ) : (
            <EmptyState
              icon={SearchX}
              description="ไม่พบผู้ใช้งานที่ตรงกับตัวกรอง ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง"
              action={
                <Button type="button" variant="outline" onClick={clear}>
                  ล้างตัวกรอง
                </Button>
              }
            />
          )
        ) : (
          <>
            {/* Narrow screens: one card per person, so the page never scrolls sideways. */}
            <ul className="grid gap-3 md:grid-cols-2 xl:hidden">
              {pagination.pageRows.map((user) => {
                const href = hrefOf(user);
                return (
                  <li
                    key={user.id}
                    onClick={rowClick(router, href)}
                    onKeyDown={rowKeyDown(router, href)}
                    tabIndex={0}
                    className={cn(
                      'interactive-row cursor-pointer space-y-3 rounded-lg border p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      !user.isActive && 'bg-slate-50/60',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <UserIdentity user={user} href={href} isSelf={user.id === currentUserId} />
                      </div>
                      <StatusColumn user={user} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <RoleBadges roles={user.roles} />
                    </div>
                    <ScopeBadges user={user} resolveTargetName={resolveTargetName} />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        สร้างเมื่อ {formatThaiDate(user.createdAt)} · เข้าใช้ล่าสุด{' '}
                        {formatLastLogin(user.lastLoginAt)}
                      </p>
                      <RowActions
                        href={href}
                        user={user}
                        basePath={basePath}
                        superAdminId={superAdminId}
                        showReason
                      />
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="hidden xl:block">
              <table className="w-full table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[30%]" />
                  <col className="w-[15%]" />
                  <col className="w-[25%]" />
                  <col className="w-[16%]" />
                  <col className="w-28" />
                </colgroup>
                <thead>
                  <tr className="border-b-2 border-slate-200 text-xs text-muted-foreground">
                    <SortHeader {...sort.sortProps('fullName')} className={TH}>
                      ชื่อและอีเมล
                    </SortHeader>
                    <th className={cn(TH, 'font-medium')}>บทบาท</th>
                    <th className={cn(TH, 'font-medium')}>ขอบเขต</th>
                    <SortHeader {...sort.sortProps('status')} className={TH}>
                      สถานะ
                    </SortHeader>
                    <th className={TH}>
                      <span className="sr-only">การดำเนินการ</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.pageRows.map((user) => {
                    const href = hrefOf(user);
                    return (
                      <tr
                        key={user.id}
                        onClick={rowClick(router, href)}
                        className={cn(
                          'interactive-row cursor-pointer border-b border-slate-100 align-middle',
                          !user.isActive && 'bg-slate-50/60',
                        )}
                      >
                        <td className={cn('px-3 py-3', !user.isActive && 'opacity-70')}>
                          <UserIdentity
                            user={user}
                            href={href}
                            isSelf={user.id === currentUserId}
                          />
                        </td>
                        <td className={cn('px-3 py-3', !user.isActive && 'opacity-70')}>
                          <div className="flex flex-wrap gap-1.5">
                            <RoleBadges roles={user.roles} />
                          </div>
                        </td>
                        <td className={cn('px-3 py-3', !user.isActive && 'opacity-70')}>
                          <ScopeBadges
                            user={user}
                            resolveTargetName={resolveTargetName}
                            limit={2}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <StatusColumn user={user} />
                          <p className="mt-1 text-xs text-muted-foreground">
                            เข้าใช้ล่าสุด {formatLastLogin(user.lastLoginAt)}
                          </p>
                        </td>
                        <td className="px-3 py-2">
                          <RowActions
                            href={href}
                            user={user}
                            basePath={basePath}
                            superAdminId={superAdminId}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        {pagination.total > 0 && (
          <Pagination {...pagination} unit="คน" onPageChange={pagination.setPage} />
        )}
      </CardContent>
    </Card>
  );
}
