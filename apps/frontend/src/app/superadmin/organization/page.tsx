'use client';

import { useAuth } from '@/lib/auth-context';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Reveal } from '@/components/layout/reveal';
import { OrgTree } from '@/components/admin/organization/org-tree';
import { Skeleton } from '@/components/ui/skeleton';

export default function OrganizationAdminPage() {
  return <OrganizationAdminContent />;
}

function OrganizationAdminContent() {
  const { user } = useAuth();

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

  return (
    <DashboardShell role="SUPER_ADMIN" identityLabel={user.email} fullName={user.fullName}>
      <Reveal index={0}>
        <PageHeader
          title="โครงสร้างองค์กร"
          description="จัดการคณะ ภาควิชา สาขา และหลักสูตร — การปิดใช้งานทำได้เมื่อไม่มีข้อมูลที่ใช้งานอยู่ภายใต้รายการนั้น"
        />
      </Reveal>
      <Reveal index={1}>
        <OrgTree />
      </Reveal>
    </DashboardShell>
  );
}
