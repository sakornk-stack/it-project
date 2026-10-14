'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateUserResponse } from '@eduanalyze-ai/shared-types';
import { summarizeUsers } from '@/lib/admin-users';
import { fetchUsers } from '@/lib/api/user-management';
import { useAuth } from '@/lib/auth-context';
import { useUserFilters } from '@/lib/use-user-filters';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-states';
import { Reveal } from '@/components/layout/reveal';
import { CreateUserForm } from '@/components/admin/create-user-form';
import { UserListSkeleton } from '@/components/admin/user-list-skeleton';
import { UserListTable } from '@/components/admin/user-list-table';
import { UserStatCards } from '@/components/admin/user-stat-cards';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton, StatCardsSkeleton, TableSkeleton } from '@/components/ui/skeleton';

export function UsersPageContent({ basePath }: Readonly<{ basePath: string }>) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createdUser, setCreatedUser] = useState<CreateUserResponse | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const filterControl = useUserFilters();

  // /superadmin/users?create=1 (the overview's "เพิ่มผู้ใช้งาน") opens the create form straight away.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('create') === '1') {
      setShowCreateForm(true);
    }
  }, []);

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
              <Button
                type="button"
                className="w-full gap-1.5 sm:w-auto"
                onClick={() => setShowCreateForm(true)}
              >
                <Plus size={16} aria-hidden="true" />
                {requesterIsSuperAdmin ? 'เพิ่มผู้ใช้งาน' : 'สร้างบัญชีเจ้าหน้าที่'}
              </Button>
            )
          }
        />
      </Reveal>

      {usersQuery.isLoading && (
        <StatCardsSkeleton
          count={requesterIsSuperAdmin ? 4 : 3}
          className={
            requesterIsSuperAdmin ? 'sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-4' : undefined
          }
        />
      )}
      {summary && (
        <UserStatCards
          summary={summary}
          requesterIsSuperAdmin={requesterIsSuperAdmin}
          control={filterControl}
        />
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

      <Reveal index={5}>
        {usersQuery.isLoading && <UserListSkeleton />}
        {usersQuery.isError && <PageLoadError onRetry={() => usersQuery.refetch()} />}
        {usersQuery.data && (
          <UserListTable
            basePath={basePath}
            users={usersQuery.data}
            superAdminId={requesterIsSuperAdmin ? user.userId : undefined}
            currentUserId={user.userId}
            control={filterControl}
          />
        )}
      </Reveal>
    </DashboardShell>
  );
}
