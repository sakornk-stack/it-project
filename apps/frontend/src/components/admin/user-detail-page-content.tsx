'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { fetchUser, updateUserActiveStatus } from '@/lib/api/user-management';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { fetchDepartments, fetchPrograms } from '@/lib/api/organization';
import {
  accessLimitations,
  canPermanentlyDelete,
  manageLockReason,
  suspendBlockReason,
} from '@/lib/admin-user-guard';
import { roleNeedsScope } from '@/lib/user-scope-requirement';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageLoadError } from '@/components/layout/page-states';
import { Reveal } from '@/components/layout/reveal';
import { UserAccessCard, UserAccountInfoCard } from '@/components/admin/user-access-aside';
import { UserProfileCard } from '@/components/admin/user-profile-card';
import { UserDangerZone, UserStatusSection } from '@/components/admin/user-status-section';
import { UserRolesSection } from '@/components/admin/user-roles-section';
import { UserScopesSection } from '@/components/admin/user-scopes-section';
import { describeApiError } from '@/lib/describe-api-error';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { ListSkeleton, Skeleton } from '@/components/ui/skeleton';

// Same grid as the loaded page, so nothing jumps when the data arrives.
function UserDetailSkeleton() {
  return (
    <div
      role="status"
      aria-label="กำลังโหลดข้อมูลบัญชี"
      className="grid grid-cols-1 gap-6 lg:grid-cols-3"
    >
      <Card className="lg:col-span-2">
        <CardContent className="space-y-5 p-4 sm:p-6">
          <div className="flex items-center gap-3 sm:gap-5">
            <Skeleton className="h-16 w-16 shrink-0 rounded-full sm:h-24 sm:w-24" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-7 w-48 max-w-full" />
              <Skeleton className="h-5 w-40 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
      <Card className="lg:col-start-3 lg:row-span-2 lg:row-start-1">
        <CardContent className="space-y-3 p-4 sm:p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
      <div className="space-y-6 lg:col-span-2">
        <ListSkeleton items={3} />
      </div>
    </div>
  );
}

export function UserDetailPageContent({
  userId,
  basePath,
}: Readonly<{ userId: string; basePath: string }>) {
  const { user: requester } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmingSuspend, setConfirmingSuspend] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const toast = useToast();

  const userQuery = useQuery({
    queryKey: ['admin-users', userId],
    queryFn: () => fetchUser(userId),
  });

  const needsCoverageCheck = !!requester && !requester.roles.includes('SUPER_ADMIN');
  const ownUserQuery = useQuery({
    queryKey: ['admin-users', requester?.userId],
    queryFn: () => fetchUser(requester!.userId),
    enabled: needsCoverageCheck,
  });
  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
    enabled: needsCoverageCheck,
  });
  const programsQuery = useQuery({
    queryKey: ['programs'],
    queryFn: fetchPrograms,
    enabled: needsCoverageCheck,
  });

  if (!requester) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="space-y-3">
          <Skeleton className="mx-auto h-10 w-10 rounded-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    );
  }

  const requesterIsSuperAdmin = requester.roles.includes('SUPER_ADMIN');
  const isSelf = requester.userId === userId;

  const roleScopeLockReason = userQuery.data
    ? manageLockReason({ isSelf, requesterIsSuperAdmin, targetRoles: userQuery.data.roles })
    : null;
  const org =
    departmentsQuery.data && programsQuery.data
      ? { departments: departmentsQuery.data, programs: programsQuery.data }
      : null;
  const suspendBlocked =
    userQuery.data && userQuery.data.isActive
      ? suspendBlockReason({
          isSelf,
          requesterIsSuperAdmin,
          targetRoles: userQuery.data.roles,
          targetScopes: userQuery.data.scopes,
          ownScopes: ownUserQuery.data?.scopes ?? null,
          org,
        })
      : roleScopeLockReason;

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ['admin-users', userId] });
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  }

  async function handleToggleActive() {
    if (!userQuery.data) return;
    setBusy(true);
    setServerError(null);
    try {
      await updateUserActiveStatus(userId, { isActive: !userQuery.data.isActive });
      toast.success(
        userQuery.data.isActive ? 'ระงับการใช้งานบัญชีแล้ว' : 'เปิดใช้งานบัญชีอีกครั้งแล้ว',
      );
      setConfirmingSuspend(false);
      refetch();
    } catch (err) {
      const message = describeApiError(err);
      setConfirmingSuspend(false);
      setServerError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const user = userQuery.data;
  // Instructors and students have no scope rows to manage; a card with nothing in it is hidden.
  const showScopes = !!user && (roleNeedsScope(user.roles) || user.scopes.length > 0);
  const canDelete =
    !!user && canPermanentlyDelete({ basePath, requesterIsSuperAdmin, isSelf, target: user });
  const limitations = user
    ? accessLimitations({
        basePath,
        isSelf,
        requesterIsSuperAdmin,
        target: user,
        ownScopes: ownUserQuery.data?.scopes ?? null,
        org,
      })
    : [];

  return (
    <DashboardShell
      role={requesterIsSuperAdmin ? 'SUPER_ADMIN' : 'ADMIN'}
      identityLabel={requester.email}
      fullName={requester.fullName}
    >
      <nav aria-label="เส้นทางหน้า" className="text-sm text-muted-foreground">
        <ol className="flex min-w-0 flex-wrap items-center gap-x-1.5">
          <li>
            <Link
              href={`${basePath}/users`}
              className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 active:bg-accent transition-colors duration-150 hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              ผู้ใช้งาน
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="min-w-0 truncate font-medium text-foreground">
            รายละเอียดบัญชี
          </li>
        </ol>
      </nav>

      {userQuery.isLoading && <UserDetailSkeleton />}
      {userQuery.isError && (
        <PageLoadError
          message="ไม่พบผู้ใช้งาน หรือไม่มีสิทธิ์เข้าถึง"
          onRetry={() => userQuery.refetch()}
        />
      )}

      {user && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* One column on a phone, in reading order: profile, what you may do here, roles,
              scopes, status, account facts, danger zone. The wrappers dissolve there
              (`contents`) so each card takes its place by `order`; from lg up they are the
              two real columns, the right one sticky. */}
          <Reveal index={0} className="order-1 min-w-0 lg:order-none lg:col-span-2">
            <UserProfileCard user={user} />
          </Reveal>

          <aside className="contents lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:block lg:space-y-6 lg:self-start lg:sticky lg:top-6">
            <Reveal index={1} className="order-2 min-w-0 lg:order-none">
              <UserAccessCard limitations={limitations} />
            </Reveal>
            <Reveal index={4} className="order-6 min-w-0 lg:order-none">
              <UserAccountInfoCard user={user} />
            </Reveal>
          </aside>

          <div className="contents lg:col-span-2 lg:block lg:min-w-0 lg:space-y-6">
            {serverError && (
              <div className="order-3 min-w-0 lg:order-none">
                <ApiErrorAlert message={serverError} />
              </div>
            )}

            <Reveal index={2} className="order-3 min-w-0 lg:order-none">
              <UserRolesSection
                userId={userId}
                roles={user.roles}
                hasScopes={user.scopes.length > 0}
                requesterIsSuperAdmin={requesterIsSuperAdmin}
                lockedReason={roleScopeLockReason}
                onChanged={refetch}
              />
            </Reveal>

            {showScopes && (
              <Reveal index={3} className="order-4 min-w-0 lg:order-none">
                <div id="user-scopes" className="scroll-mt-6">
                  <UserScopesSection
                    userId={userId}
                    roles={user.roles}
                    scopes={user.scopes}
                    lockedReason={roleScopeLockReason}
                    requesterIsSuperAdmin={requesterIsSuperAdmin}
                    requesterScopes={ownUserQuery.data?.scopes ?? null}
                    onChanged={refetch}
                  />
                </div>
              </Reveal>
            )}

            <Reveal index={4} className="order-5 min-w-0 lg:order-none">
              <UserStatusSection
                user={user}
                requesterId={requester.userId}
                requesterIsSuperAdmin={requesterIsSuperAdmin}
                suspendBlocked={suspendBlocked}
                busy={busy}
                onToggleActive={() =>
                  user.isActive ? setConfirmingSuspend(true) : void handleToggleActive()
                }
              />
            </Reveal>

            {canDelete && (
              <Reveal index={5} className="order-7 min-w-0 lg:order-none">
                <UserDangerZone
                  user={user}
                  requesterId={requester.userId}
                  requesterIsSuperAdmin={requesterIsSuperAdmin}
                  basePath={basePath}
                  onDeleted={() => router.push(`${basePath}/users`)}
                />
              </Reveal>
            )}
          </div>
        </div>
      )}

      {userQuery.data && (
        <ConfirmDialog
          open={confirmingSuspend}
          onOpenChange={setConfirmingSuspend}
          title={`ระงับบัญชีของ ${userQuery.data.fullName}?`}
          description={
            <>
              <p>
                {userQuery.data.fullName} ({userQuery.data.email}) จะเข้าสู่ระบบไม่ได้ทันที
                และเซสชันที่ใช้งานอยู่จะใช้งานต่อไม่ได้
              </p>
              <p className="mt-2">เปิดใช้งานอีกครั้งได้ภายหลังจากหน้านี้</p>
            </>
          }
          confirmLabel="ระงับบัญชี"
          busy={busy}
          onConfirm={handleToggleActive}
        />
      )}
    </DashboardShell>
  );
}
