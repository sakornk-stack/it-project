'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, UserRound } from 'lucide-react';
import type { AdminUserSummary, Role } from '@eduanalyze-ai/shared-types';
import { compareUsersDefault, formatThaiDate } from '@/lib/admin-users';
import { SCOPE_LEVEL_LABELS } from '@/lib/scope-labels';
import { usePagination } from '@/lib/use-pagination';
import { useScopeTargetName } from '@/lib/use-scope-target-name';
import { roleNeedsScope } from '@/lib/user-scope-requirement';
import { useTableSort } from '@/lib/use-table-sort';
import { ROLE_BADGE_TONE, ROLE_LABEL_TH } from '@/components/auth/require-role';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BAR_TONE_CLASSES } from '@/lib/tone';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SortHeader } from '@/components/ui/sort-header';
import { useResendInvitation } from '@/components/admin/resend-invitation-button';
import { UserRowMenu } from '@/components/admin/user-row-menu';
import { UserManageBlocked, useUserStatusToggle } from '@/components/admin/user-status-action';
import { userMenuEntries } from '@/lib/user-row-actions';

const ALL = 'ALL';
const NO_SCOPE = 'NO_SCOPE';
const ACTIVE = 'ACTIVE';
const SUSPENDED = 'SUSPENDED';

// STUDENT never appears here (the list endpoint excludes them).
const FILTERABLE_ROLES = (Object.keys(ROLE_LABEL_TH) as Role[]).filter(
  (role) => role !== 'STUDENT',
);

// One badge per account so every row is the same height. Suspended wins over
// "waiting for a password"; the wording carries the meaning, the dot only repeats it.
function StatusColumn({ user }: Readonly<{ user: AdminUserSummary }>) {
  const pending = user.isActive && user.mustChangePassword;
  const tone = pending ? 'warning' : user.isActive ? 'success' : 'neutral';
  const text = pending ? 'รอตั้งรหัสผ่าน' : user.isActive ? 'ใช้งานอยู่' : 'ระงับการใช้งาน';
  return (
    <Badge tone={tone} className="gap-1.5 whitespace-nowrap">
      <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', BAR_TONE_CLASSES[tone])} />
      {text}
    </Badge>
  );
}

function UserAvatar() {
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand"
    >
      <UserRound size={18} />
    </span>
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

function ScopeBadges({
  user,
  resolveTargetName,
}: Readonly<{
  user: AdminUserSummary;
  resolveTargetName: ReturnType<typeof useScopeTargetName>;
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
  return (
    <ul className="space-y-1.5">
      {user.scopes.map((scope) => (
        <li key={scope.id} className="text-sm leading-snug">
          <span className="block text-xs text-muted-foreground">
            {SCOPE_LEVEL_LABELS[scope.level]}
          </span>
          <span className="block break-words font-medium">{resolveTargetName(scope)}</span>
        </li>
      ))}
    </ul>
  );
}

function DetailLink({
  basePath,
  id,
  className,
  label = 'ดูรายละเอียด',
  arrow = true,
}: Readonly<{
  basePath: string;
  id: string;
  className?: string;
  label?: string;
  arrow?: boolean;
}>) {
  return (
    <Link
      href={`${basePath}/users/${id}`}
      className={cn(buttonVariants({ variant: 'outline' }), 'gap-1.5', className)}
    >
      {label}
      {arrow && <ArrowRight size={14} aria-hidden="true" />}
    </Link>
  );
}

// An Admin only opens the detail page; a Super Admin gets the fixed pair
// "แก้ไข" + "⋯" on every manageable row (resend and suspend live in the menu).
function RowActions({
  basePath,
  user,
  superAdminId,
  showReason = false,
  className,
}: Readonly<{
  basePath: string;
  user: AdminUserSummary;
  superAdminId?: string;
  showReason?: boolean;
  className?: string;
}>) {
  if (!superAdminId) return <DetailLink basePath={basePath} id={user.id} className={className} />;
  return (
    <SuperAdminRowActions
      basePath={basePath}
      user={user}
      superAdminId={superAdminId}
      showReason={showReason}
      className={className}
    />
  );
}

function SuperAdminRowActions({
  basePath,
  user,
  superAdminId,
  showReason,
  className,
}: Readonly<{
  basePath: string;
  user: AdminUserSummary;
  superAdminId: string;
  showReason: boolean;
  className?: string;
}>) {
  const status = useUserStatusToggle(user, superAdminId);
  const resend = useResendInvitation({
    user,
    requesterId: superAdminId,
    requesterIsSuperAdmin: true,
    errorPlacement: 'toast',
  });
  // Other Super Admins and your own account cannot be edited or suspended here.
  const locked = user.roles.includes('SUPER_ADMIN');

  const actions = { resend: resend.request, suspend: status.request, reactivate: status.request };
  const menuItems = userMenuEntries({
    canResend: resend.canResend,
    statusBlocked: status.blockReason !== null,
    isActive: user.isActive,
  }).map((entry) => ({
    ...entry,
    onSelect: actions[entry.key],
    disabled: status.busy || resend.busy,
  }));

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-2 xl:justify-end">
        {!locked && (
          <DetailLink basePath={basePath} id={user.id} label="แก้ไข" arrow={false} className="flex-1 xl:flex-none" />
        )}
        {status.blockReason && <UserManageBlocked reason={status.blockReason} />}
        <UserRowMenu userName={user.fullName} items={menuItems} />
      </div>
      {showReason && status.blockReason && (
        <span className="text-xs text-muted-foreground">{status.blockReason}</span>
      )}
      {status.dialog}
      {resend.dialog}
    </div>
  );
}

export function UserListTable({
  basePath,
  users,
  superAdminId,
}: {
  // Route tree the detail links point into: /admin or /superadmin.
  basePath: string;
  users: AdminUserSummary[];
  // Set only for a Super Admin: turns on editing and suspending from each row.
  superAdminId?: string;
}) {
  const resolveTargetName = useScopeTargetName();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | typeof ALL>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ACTIVE);
  const [scopeFilter, setScopeFilter] = useState<string>(ALL);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter(
      (user) =>
        (term === '' ||
          user.fullName.toLowerCase().includes(term) ||
          user.email.toLowerCase().includes(term)) &&
        (roleFilter === ALL || user.roles.includes(roleFilter)) &&
        (statusFilter === ALL || (statusFilter === ACTIVE ? user.isActive : !user.isActive)) &&
        (scopeFilter === ALL || (roleNeedsScope(user.roles) && user.scopes.length === 0)),
    );
  }, [users, search, roleFilter, statusFilter, scopeFilter]);
  const isFiltered =
    search.trim() !== '' || roleFilter !== ALL || statusFilter !== ALL || scopeFilter !== ALL;

  const ordered = useMemo(() => [...filtered].sort(compareUsersDefault), [filtered]);
  const sort = useTableSort(ordered, {
    fullName: (u) => u.fullName,
    email: (u) => u.email,
    status: (u) => (u.isActive ? 0 : 1),
    createdAt: (u) => u.createdAt,
  });
  const pagination = usePagination(
    sort.sorted,
    undefined,
    `${sort.sortKey}|${sort.direction}|${search.trim()}|${roleFilter}|${statusFilter}|${scopeFilter}`,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>รายชื่อผู้ใช้งาน</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Input
            placeholder="ค้นหาชื่อหรืออีเมล..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          <Select
            value={roleFilter}
            onValueChange={(value) => setRoleFilter(value as Role | typeof ALL)}
          >
            <SelectTrigger className="w-full sm:w-44" aria-label="กรองตามบทบาท">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem className="min-h-11" value={ALL}>
                ทุกบทบาท
              </SelectItem>
              {FILTERABLE_ROLES.map((role) => (
                <SelectItem key={role} value={role} className="min-h-11">
                  {ROLE_LABEL_TH[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40" aria-label="กรองตามสถานะ">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem className="min-h-11" value={ALL}>
                ทุกสถานะ
              </SelectItem>
              <SelectItem className="min-h-11" value={ACTIVE}>
                ใช้งานอยู่
              </SelectItem>
              <SelectItem className="min-h-11" value={SUSPENDED}>
                ระงับการใช้งาน
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={scopeFilter} onValueChange={setScopeFilter}>
            <SelectTrigger className="w-full sm:w-52" aria-label="กรองตามขอบเขต">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem className="min-h-11" value={ALL}>
                ขอบเขตทั้งหมด
              </SelectItem>
              <SelectItem className="min-h-11" value={NO_SCOPE}>
                ยังไม่กำหนดขอบเขต
              </SelectItem>
            </SelectContent>
          </Select>
          {isFiltered && (
            <span className="text-sm text-muted-foreground">
              แสดง {filtered.length} จาก {users.length} คน
            </span>
          )}
        </div>
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">
            {users.length === 0
              ? 'ยังไม่มีผู้ใช้งานในขอบเขตของคุณ กด “เพิ่มผู้ใช้งาน” ที่มุมบนเพื่อสร้างบัญชีแรก'
              : 'ไม่พบผู้ใช้งานที่ตรงกับตัวกรอง ลองเปลี่ยนหรือล้างตัวกรองด้านบน'}
          </p>
        ) : (
          <>
            {/* Narrow screens: one card per person, so the page never scrolls sideways. */}
            <ul className="grid gap-3 md:grid-cols-2 xl:hidden">
              {pagination.pageRows.map((user) => (
                <li
                  key={user.id}
                  className={cn(
                    'space-y-3 rounded-lg border p-4',
                    !user.isActive && 'bg-slate-50/60',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <UserAvatar />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="break-words font-semibold text-primary">{user.fullName}</p>
                      <p className="break-all text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <StatusColumn user={user} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <RoleBadges roles={user.roles} />
                  </div>
                  <ScopeBadges user={user} resolveTargetName={resolveTargetName} />
                  <p className="text-xs text-muted-foreground">
                    สร้างเมื่อ {formatThaiDate(user.createdAt)}
                  </p>
                  <RowActions basePath={basePath} user={user} superAdminId={superAdminId} showReason />
                </li>
              ))}
            </ul>

            <div className="hidden xl:block">
              <table className="w-full table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[26%]" />
                  <col className="w-[14%]" />
                  <col className="w-[22%]" />
                  <col className="w-[15%]" />
                  <col className="w-48" />
                </colgroup>
                <thead>
                  <tr className="border-b-2 border-slate-200 bg-slate-50 text-xs text-muted-foreground">
                    <SortHeader {...sort.sortProps('fullName')} className="px-3 py-3">
                      ชื่อและอีเมล
                    </SortHeader>
                    <th className="px-3 py-3 font-medium">บทบาท</th>
                    <th className="px-3 py-3 font-medium">ขอบเขต</th>
                    <SortHeader {...sort.sortProps('status')} className="px-3 py-3">
                      สถานะ
                    </SortHeader>
                    <th className="px-3 py-3 text-right font-medium">การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.pageRows.map((user) => (
                    <tr
                      key={user.id}
                      className={cn(
                        'border-b border-slate-100 align-middle hover:bg-slate-50',
                        !user.isActive && 'bg-slate-50/60',
                      )}
                    >
                      <td className={cn('px-3 py-3', !user.isActive && 'opacity-70')}>
                        <span className="flex items-start gap-3">
                          <UserAvatar />
                          <span className="min-w-0 space-y-0.5">
                            <span className="block break-words font-medium text-primary">
                              {user.fullName}
                            </span>
                            <span className="block break-all text-xs text-muted-foreground">
                              {user.email}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className={cn('px-3 py-3', !user.isActive && 'opacity-70')}>
                        <div className="flex flex-wrap gap-1.5">
                          <RoleBadges roles={user.roles} />
                        </div>
                      </td>
                      <td className={cn('px-3 py-3', !user.isActive && 'opacity-70')}>
                        <ScopeBadges user={user} resolveTargetName={resolveTargetName} />
                      </td>
                      <td className="px-3 py-3">
                        <StatusColumn user={user} />
                      </td>
                      <td className="px-3 py-2">
                        <RowActions basePath={basePath} user={user} superAdminId={superAdminId} />
                      </td>
                    </tr>
                  ))}
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
