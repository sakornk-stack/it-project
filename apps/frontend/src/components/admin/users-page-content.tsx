'use client';

import { useState } from 'react';
import Link from 'next/link';
import { KeyRound, Plus, ShieldOff, UserCheck, UserCog, UsersRound } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateUserResponse } from '@eduanalyze-ai/shared-types';
import { activeShare, summarizeUsers } from '@/lib/admin-users';
import { fetchUsers } from '@/lib/api/user-management';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { StatCard } from '@/components/dashboard/stat-card';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-states';
import { Reveal } from '@/components/layout/reveal';
import { CreateUserForm } from '@/components/admin/create-user-form';
import { UserListTable } from '@/components/admin/user-list-table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Skeleton, StatCardsSkeleton, TableSkeleton } from '@/components/ui/skeleton';

export function UsersPageContent({ basePath }: Readonly<{ basePath: string }>) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createdUser, setCreatedUser] = useState<CreateUserResponse | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: fetchUsers });

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-3">
          <Skeleton className="mx-auto h-10 w-10 rounded-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    );
  }

  const requesterIsSuperAdmin = user.roles.includes('SUPER_ADMIN');
  const summary = usersQuery.data ? summarizeUsers(usersQuery.data) : null;
  const share = summary ? activeShare(summary) : null;

  function handleCreated(result: CreateUserResponse) {
    setCreatedUser(result);
    setShowCreateForm(false);
  }

  function handleAcknowledge() {
    setCreatedUser(null);
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  }

  return (
    <DashboardShell
      role={requesterIsSuperAdmin ? 'SUPER_ADMIN' : 'ADMIN'}
      identityLabel={user.email}
      fullName={user.fullName}
    >
      <Reveal index={0}>
        <PageHeader
          title="การจัดการผู้ใช้งาน"
          description={
            requesterIsSuperAdmin
              ? 'ตรวจสอบ กำหนดบทบาท และควบคุมขอบเขตความรับผิดชอบของบุคลากรภายในสถาบัน'
              : 'ตรวจสอบสิทธิ์และสถานะบัญชีบุคลากรในขอบเขตที่รับผิดชอบ'
          }
          actions={
            !createdUser &&
            !showCreateForm && (
              <Button type="button" className="gap-1.5" onClick={() => setShowCreateForm(true)}>
                <Plus size={16} aria-hidden="true" />
                {requesterIsSuperAdmin ? 'เพิ่มผู้ใช้งาน' : 'สร้างบัญชีเจ้าหน้าที่'}
              </Button>
            )
          }
        />
      </Reveal>

      {usersQuery.isLoading && <StatCardsSkeleton count={3} />}
      {summary && (
        <Reveal index={1}>
          <div className="space-y-3">
            <div
              className={
                requesterIsSuperAdmin
                  ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'
                  : 'grid grid-cols-1 gap-4 sm:grid-cols-3'
              }
            >
              <StatCard
                dense
                icon={UsersRound}
                label={requesterIsSuperAdmin ? 'บัญชีบุคลากรทั้งหมด' : 'บัญชีทั้งหมด'}
                value={<AnimatedNumber value={summary.total} />}
                suffix="บัญชี"
              />
              {requesterIsSuperAdmin ? (
                <StatCard
                  dense
                  icon={KeyRound}
                  label="รอตั้งรหัสผ่าน"
                  value={<AnimatedNumber value={summary.pendingPassword} />}
                  suffix="บัญชี"
                />
              ) : (
                <StatCard
                  dense
                  icon={UserCog}
                  label="เจ้าหน้าที่"
                  value={<AnimatedNumber value={summary.byRole.STAFF} />}
                  suffix="คน"
                />
              )}
              {requesterIsSuperAdmin && (
                <StatCard
                  dense
                  icon={UserCheck}
                  label="ใช้งานอยู่"
                  value={<AnimatedNumber value={summary.active} />}
                  suffix={share === null ? 'บัญชี' : `บัญชี (${share.toFixed(1)}%)`}
                />
              )}
              <StatCard
                dense
                icon={ShieldOff}
                label="ระงับการใช้งาน"
                value={<AnimatedNumber value={summary.suspended} />}
                suffix="บัญชี"
              />
            </div>
            {summary.withoutScope > 0 && (
              <p className="text-sm font-medium text-amber-700">
                มี {summary.withoutScope} บัญชีที่ยังไม่กำหนดขอบเขต
              </p>
            )}
          </div>
        </Reveal>
      )}

      {createdUser && (
        <Card
          className={
            createdUser.passwordSetupEmailSent
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-amber-200 bg-amber-50'
          }
        >
          <CardContent className="space-y-4 pt-6">
            <p
              className={`text-sm font-medium ${createdUser.passwordSetupEmailSent ? 'text-emerald-900' : 'text-amber-900'}`}
            >
              เพิ่มผู้ใช้งานสำเร็จ — {createdUser.fullName} ({createdUser.email})
            </p>
            {createdUser.passwordSetupEmailSent ? (
              <Alert>
                <AlertDescription>
                  ระบบส่งอีเมลตั้งรหัสผ่านให้ {createdUser.email} แล้ว —
                  ผู้ใช้จะได้รับลิงก์สำหรับตั้งรหัสผ่านของตัวเอง
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertDescription>
                  ส่งอีเมลไม่สำเร็จ (ระบบส่งอีเมลขัดข้อง) — บัญชีถูกสร้างแล้ว แจ้งให้ผู้ใช้กด
                  &ldquo;ลืมรหัสผ่าน&rdquo; ที่หน้าเข้าสู่ระบบด้วยอีเมล {createdUser.email}{' '}
                  เพื่อตั้งรหัสผ่านเอง
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap items-center gap-4">
              <Button type="button" onClick={handleAcknowledge}>
                รับทราบ ปิดหน้าต่างนี้
              </Button>
              <Link
                href={`${basePath}/users/${createdUser.id}`}
                className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline"
              >
                ไปที่หน้าผู้ใช้เพื่อจัดการบทบาทและขอบเขต
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {showCreateForm && !createdUser && (
        <Reveal animate={false}>
          <CreateUserForm
            requesterIsSuperAdmin={requesterIsSuperAdmin}
            onCreated={handleCreated}
            onCancel={() => setShowCreateForm(false)}
          />
        </Reveal>
      )}

      <Reveal index={2}>
        {usersQuery.isLoading && (
          <Card>
            <CardHeader>
              <CardTitle>รายชื่อผู้ใช้งาน</CardTitle>
            </CardHeader>
            <CardContent>
              <TableSkeleton cols={4} rows={6} />
            </CardContent>
          </Card>
        )}
        {usersQuery.isError && <PageLoadError onRetry={() => usersQuery.refetch()} />}
        {usersQuery.data && (
          <UserListTable
            basePath={basePath}
            users={usersQuery.data}
            superAdminId={requesterIsSuperAdmin ? user.userId : undefined}
            currentUserId={user.userId}
          />
        )}
      </Reveal>
    </DashboardShell>
  );
}
