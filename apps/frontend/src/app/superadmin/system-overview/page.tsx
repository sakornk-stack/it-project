'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, LayoutGrid, Plus } from 'lucide-react';
import { fetchDepartments, fetchFaculties, fetchPrograms } from '@/lib/api/organization';
import { fetchUsers } from '@/lib/api/user-management';
import { BRAND_NAME } from '@/lib/brand';
import { systemUserCounts } from '@/lib/system-overview';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { OrgStatCards } from '@/components/admin/system-overview/org-stat-cards';
import { OverviewCardsSkeleton } from '@/components/admin/system-overview/overview-skeleton';
import { QuickLinks } from '@/components/admin/system-overview/quick-links';
import { RoleShareBar } from '@/components/admin/system-overview/role-share-bar';
import { RoleStatCards } from '@/components/admin/system-overview/role-stat-cards';
import {
  BANNER_PRIMARY_BUTTON,
  BANNER_SECONDARY_BUTTON,
  WelcomeBanner,
} from '@/components/dashboard/welcome-banner';
import { PageLoadError } from '@/components/layout/page-states';
import { PageSection } from '@/components/layout/page-section';
import { Reveal } from '@/components/layout/reveal';
import { Button } from '@/components/ui/button';
import { AuthLoadingScreen } from '@/components/auth/auth-loading-screen';

const linkClass =
  'inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline';

export default function SystemOverviewPage() {
  return <SystemOverviewContent />;
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

  if (!user) return <AuthLoadingScreen />;

  const orgReady = facultiesQuery.data && departmentsQuery.data && programsQuery.data;
  const orgFailed = facultiesQuery.isError || departmentsQuery.isError || programsQuery.isError;

  return (
    <DashboardShell role="SUPER_ADMIN" identityLabel={user.email} fullName={user.fullName}>
      <Reveal index={0}>
        <WelcomeBanner
          chips={[
            <>
              <LayoutGrid size={13} aria-hidden="true" />
              ภาพรวมระบบ
            </>,
            <>ผู้ดูแลระบบสูงสุด</>,
          ]}
          title={`สวัสดี, ${user.fullName}`}
          summary={`โครงสร้างหน่วยงานและบัญชีบุคลากรของ ${BRAND_NAME}`}
          actions={
            <>
              <Button asChild className={BANNER_PRIMARY_BUTTON}>
                <Link href="/superadmin/users?create=1">
                  <Plus size={16} aria-hidden="true" />
                  เพิ่มผู้ใช้งาน
                </Link>
              </Button>
              <Button asChild variant="outline" className={BANNER_SECONDARY_BUTTON}>
                <Link href="/superadmin/academic-years">
                  <CalendarClock size={16} aria-hidden="true" />
                  ปีการศึกษา
                </Link>
              </Button>
            </>
          }
        />
      </Reveal>

      <PageSection
        title="โครงสร้างหน่วยงาน"
        description="นับเฉพาะหน่วยงานที่เปิดใช้งานอยู่"
        actions={
          <Link href="/superadmin/organization" className={linkClass}>
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
        {!orgFailed && !orgReady && (
          <OverviewCardsSkeleton count={3} className="sm:grid-cols-2 md:grid-cols-3" />
        )}
        {orgReady && (
          <OrgStatCards
            faculties={facultiesQuery.data.length}
            departments={departmentsQuery.data.length}
            programs={programsQuery.data.length}
          />
        )}
      </PageSection>

      <PageSection
        title="ผู้ใช้งานแยกตามบทบาท"
        description={
          userCounts
            ? `นับเฉพาะบัญชีที่ยังใช้งานได้ รวมทั้งสิ้น ${userCounts.total.toLocaleString('th-TH')} คน (ไม่รวมนิสิต)`
            : 'นับเฉพาะบัญชีที่ยังใช้งานได้ (ไม่รวมนิสิต)'
        }
        actions={
          <Link href="/superadmin/users" className={linkClass}>
            จัดการผู้ใช้งาน
          </Link>
        }
      >
        {usersQuery.isError && <PageLoadError onRetry={() => void usersQuery.refetch()} />}
        {!usersQuery.isError && !userCounts && (
          <OverviewCardsSkeleton count={4} className="sm:grid-cols-2 xl:grid-cols-4" />
        )}
        {userCounts && (
          <>
            <RoleShareBar counts={userCounts} />
            <RoleStatCards counts={userCounts} />
          </>
        )}
      </PageSection>

      <PageSection title="ทางลัด" description="ไปยังงานที่ใช้บ่อยของผู้ดูแลระบบสูงสุด">
        <QuickLinks />
      </PageSection>
    </DashboardShell>
  );
}
