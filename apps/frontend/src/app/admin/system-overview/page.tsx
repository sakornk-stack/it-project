'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Building2, GraduationCap, Landmark, ShieldCheck, UserCog, Users } from 'lucide-react';
import { fetchDepartments, fetchFaculties, fetchPrograms } from '@/lib/api/organization';
import { fetchUsers } from '@/lib/api/user-management';
import { systemUserCounts } from '@/lib/system-overview';
import { useAuth } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { RequireRole } from '@/components/auth/require-role';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { StatCard } from '@/components/dashboard/stat-card';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-states';
import { PageSection } from '@/components/layout/page-section';
import { Reveal } from '@/components/layout/reveal';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Skeleton, StatCardsSkeleton } from '@/components/ui/skeleton';

const linkClass =
  'inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline';

export default function SystemOverviewPage() {
  return (
    <ProtectedRoute>
      <RequireRole role="SUPER_ADMIN">
        <SystemOverviewContent />
      </RequireRole>
    </ProtectedRoute>
  );
}

function SystemOverviewContent() {
  const { user } = useAuth();
  const facultiesQuery = useQuery({ queryKey: ['org-faculties'], queryFn: fetchFaculties });
  const departmentsQuery = useQuery({ queryKey: ['org-departments'], queryFn: fetchDepartments });
  const programsQuery = useQuery({ queryKey: ['org-programs'], queryFn: fetchPrograms });
  const usersQuery = useQuery({ queryKey: ['admin-users'], queryFn: fetchUsers });

  const userCounts = useMemo(
    () => (usersQuery.data ? systemUserCounts(usersQuery.data) : null),
    [usersQuery.data],
  );

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

  const orgReady = facultiesQuery.data && departmentsQuery.data && programsQuery.data;
  const orgFailed = facultiesQuery.isError || departmentsQuery.isError || programsQuery.isError;

  return (
    <DashboardShell role="SUPER_ADMIN" identityLabel={user.email} fullName={user.fullName}>
      <Reveal index={0}>
        <PageHeader title="ภาพรวมระบบ" description="โครงสร้างหน่วยงานและผู้ใช้งานแยกตามบทบาท" />
      </Reveal>

      <Reveal index={1}>
        <PageSection
          title="โครงสร้างหน่วยงาน"
          description="นับเฉพาะหน่วยงานที่เปิดใช้งานอยู่"
          actions={
            <Link href="/admin/organization" className={linkClass}>
              ไปที่โครงสร้างองค์กร
            </Link>
          }
        >
          {orgFailed && (
            <PageLoadError
              onRetry={() => {
                void facultiesQuery.refetch();
                void departmentsQuery.refetch();
                void programsQuery.refetch();
              }}
            />
          )}
          {!orgFailed && !orgReady && <StatCardsSkeleton count={3} />}
          {orgReady && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <StatCard
                icon={Landmark}
                label="คณะ"
                value={<AnimatedNumber value={facultiesQuery.data.length} />}
                suffix="คณะ"
              />
              <StatCard
                icon={Building2}
                label="ภาควิชา"
                value={<AnimatedNumber value={departmentsQuery.data.length} />}
                suffix="ภาควิชา"
              />
              <StatCard
                icon={GraduationCap}
                label="สาขา"
                value={<AnimatedNumber value={programsQuery.data.length} />}
                suffix="สาขา"
              />
            </div>
          )}
        </PageSection>
      </Reveal>

      <Reveal index={2}>
        <PageSection
          title="ผู้ใช้งานแยกตามบทบาท"
          description={
            userCounts
              ? `นับเฉพาะบัญชีที่ยังใช้งานได้ รวมทั้งสิ้น ${userCounts.total.toLocaleString('th-TH')} คน (ไม่รวมนิสิต)`
              : 'นับเฉพาะบัญชีที่ยังใช้งานได้ (ไม่รวมนิสิต)'
          }
          actions={
            <Link href="/admin/users" className={linkClass}>
              จัดการผู้ใช้งาน
            </Link>
          }
        >
          {usersQuery.isError && <PageLoadError onRetry={() => void usersQuery.refetch()} />}
          {!usersQuery.isError && !userCounts && <StatCardsSkeleton count={4} />}
          {userCounts && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={ShieldCheck}
                label="ผู้ดูแลระบบสูงสุด"
                value={<AnimatedNumber value={userCounts.superAdmin} />}
                suffix="คน"
              />
              <StatCard
                icon={ShieldCheck}
                label="ผู้ดูแลระบบ"
                value={<AnimatedNumber value={userCounts.admin} />}
                suffix="คน"
              />
              <StatCard
                icon={UserCog}
                label="เจ้าหน้าที่"
                value={<AnimatedNumber value={userCounts.staff} />}
                suffix="คน"
              />
              <StatCard
                icon={Users}
                label="อาจารย์"
                value={<AnimatedNumber value={userCounts.instructor} />}
                suffix="คน"
              />
            </div>
          )}
        </PageSection>
      </Reveal>
    </DashboardShell>
  );
}
