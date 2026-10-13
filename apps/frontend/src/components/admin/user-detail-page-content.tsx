'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, Info, Mail } from 'lucide-react';
import { formatThaiDate } from '@/lib/admin-users';
import { fetchUser, updateUserActiveStatus } from '@/lib/api/user-management';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { fetchDepartments, fetchPrograms } from '@/lib/api/organization';
import { canResendInvitation } from '@/lib/resend-invitation';
import { manageLockReason, SELF_LOCK_REASON, suspendBlockReason } from '@/lib/admin-user-guard';
import { MISSING_SCOPE_WARNING, roleNeedsScope } from '@/lib/user-scope-requirement';
import { ROLE_BADGE_TONE, ROLE_LABEL_TH } from '@/components/auth/require-role';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageLoadError } from '@/components/layout/page-states';
import { PageHeader } from '@/components/layout/page-header';
import { Reveal } from '@/components/layout/reveal';
import { ResendInvitationButton } from '@/components/admin/resend-invitation-button';
import { UserPermanentDeleteButton } from '@/components/admin/user-permanent-delete';
import { UserRolesSection } from '@/components/admin/user-roles-section';
import { UserScopesSection } from '@/components/admin/user-scopes-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { describeApiError } from '@/lib/describe-api-error';
import { ApiErrorAlert, WARNING_ALERT_CLASS } from '@/components/admin/api-error-alert';
import { InlineNotice } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListSkeleton, Skeleton } from '@/components/ui/skeleton';

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
      <div className="flex min-h-screen items-center justify-center">
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

  return (
    <DashboardShell
      role={requesterIsSuperAdmin ? 'SUPER_ADMIN' : 'ADMIN'}
      identityLabel={requester.email}
      fullName={requester.fullName}
    >
      <Link
        href={`${basePath}/users`}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={14} />
        กลับไปรายชื่อผู้ใช้งาน
      </Link>

      {userQuery.isLoading && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-48" />
          </div>
          <ListSkeleton items={3} />
        </div>
      )}
      {userQuery.isError && (
        <PageLoadError
          message="ไม่พบผู้ใช้งาน หรือไม่มีสิทธิ์เข้าถึง"
          onRetry={() => userQuery.refetch()}
        />
      )}

      {userQuery.data && (
        <>
          <Reveal index={0}>
            <PageHeader
              title={userQuery.data.fullName}
              description={
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={userQuery.data.isActive ? 'success' : 'neutral'} className="gap-1.5">
                    <span
                      aria-hidden="true"
                      className={
                        userQuery.data.isActive
                          ? 'h-1.5 w-1.5 rounded-full bg-emerald-500'
                          : 'h-1.5 w-1.5 rounded-full bg-slate-400'
                      }
                    />
                    {userQuery.data.isActive ? 'สถานะ: ใช้งานอยู่' : 'สถานะ: ระงับการใช้งาน'}
                  </Badge>
                  {userQuery.data.roles.map((role) => (
                    <Badge key={role} tone={ROLE_BADGE_TONE[role]}>
                      {ROLE_LABEL_TH[role]}
                    </Badge>
                  ))}
                </span>
              }
            />
          </Reveal>

          {isSelf && (
            <InlineNotice icon={Info} solid>
              {SELF_LOCK_REASON}
            </InlineNotice>
          )}

          <Reveal index={1}>
            <Card>
              <CardContent className="p-5 sm:p-6">
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Mail size={14} aria-hidden="true" />
                      อีเมลสถาบัน
                    </dt>
                    <dd className="mt-1 break-all font-medium">{userQuery.data.email}</dd>
                  </div>
                  <div className="rounded-lg border p-4">
                    <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <CalendarDays size={14} aria-hidden="true" />
                      วันที่สร้างบัญชี
                    </dt>
                    <dd className="mt-1 font-medium tabular-nums">
                      {formatThaiDate(userQuery.data.createdAt)}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </Reveal>

          {serverError && <ApiErrorAlert message={serverError} />}

          {roleNeedsScope(userQuery.data.roles) && userQuery.data.scopes.length === 0 && (
            <Alert className={WARNING_ALERT_CLASS}>
              <AlertDescription>
                ผู้ใช้นี้ยังไม่มีขอบเขตความรับผิดชอบ — {MISSING_SCOPE_WARNING}{' '}
                <a href="#user-scopes" className="font-medium underline">
                  ไปที่การกำหนดขอบเขต
                </a>
              </AlertDescription>
            </Alert>
          )}

          <Reveal index={1}>
            <Card>
              <CardHeader>
                <CardTitle>สถานะบัญชี</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted px-3 py-2">
                  <span className="text-sm text-muted-foreground">
                    {userQuery.data.isActive
                      ? 'บัญชีนี้เข้าสู่ระบบได้ตามปกติ'
                      : 'บัญชีนี้ถูกระงับ ไม่สามารถเข้าสู่ระบบได้'}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {suspendBlocked ? (
                      suspendBlocked !== SELF_LOCK_REASON && (
                        <span className="max-w-md text-xs text-muted-foreground" role="note">
                          {suspendBlocked}
                        </span>
                      )
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          userQuery.data.isActive
                            ? setConfirmingSuspend(true)
                            : handleToggleActive()
                        }
                      >
                        {userQuery.data.isActive ? 'ระงับการใช้งาน' : 'เปิดใช้งานอีกครั้ง'}
                      </Button>
                    )}
                    <UserPermanentDeleteButton
                      user={userQuery.data}
                      requesterId={requester.userId}
                      requesterIsSuperAdmin={requesterIsSuperAdmin}
                      basePath={basePath}
                      onDeleted={() => router.push(`${basePath}/users`)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Reveal>

          {canResendInvitation({
            isSelf,
            requesterIsSuperAdmin,
            user: userQuery.data,
          }) && (
            <Reveal index={2}>
              <Card>
                <CardHeader>
                  <CardTitle>คำเชิญตั้งรหัสผ่าน</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    ผู้ใช้นี้ยังไม่ได้ตั้งรหัสผ่าน หากยังไม่ได้รับอีเมลหรือลิงก์หมดอายุ
                    ส่งลิงก์ตั้งรหัสผ่านใหม่ได้ที่นี่
                  </p>
                  <ResendInvitationButton
                    user={userQuery.data}
                    requesterId={requester.userId}
                    requesterIsSuperAdmin={requesterIsSuperAdmin}
                  />
                </CardContent>
              </Card>
            </Reveal>
          )}

          <Reveal index={2}>
            <UserRolesSection
              userId={userId}
              roles={userQuery.data.roles}
              hasScopes={userQuery.data.scopes.length > 0}
              requesterIsSuperAdmin={requesterIsSuperAdmin}
              lockedReason={roleScopeLockReason}
              onChanged={refetch}
            />
          </Reveal>

          <Reveal index={3}>
            <div id="user-scopes" className="scroll-mt-6">
              <UserScopesSection
                userId={userId}
                roles={userQuery.data.roles}
                scopes={userQuery.data.scopes}
                lockedReason={roleScopeLockReason}
                requesterIsSuperAdmin={requesterIsSuperAdmin}
                requesterScopes={ownUserQuery.data?.scopes ?? null}
                onChanged={refetch}
              />
            </div>
          </Reveal>
        </>
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
