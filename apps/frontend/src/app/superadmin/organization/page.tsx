'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Reveal } from '@/components/layout/reveal';
import { OrgTree } from '@/components/admin/organization/org-tree';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function OrganizationAdminPage() {
  return <OrganizationAdminContent />;
}

function OrganizationAdminContent() {
  const { user } = useAuth();
  const [addingFaculty, setAddingFaculty] = useState(false);

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
          description="จัดการคณะ ภาควิชา สาขา และหลักสูตร"
          actions={
            !addingFaculty && (
              <Button
                type="button"
                className="min-h-11 w-full gap-1.5 sm:w-auto"
                onClick={() => setAddingFaculty(true)}
              >
                <Plus size={16} aria-hidden="true" />
                เพิ่มคณะใหม่
              </Button>
            )
          }
        />
      </Reveal>
      <OrgTree addingFaculty={addingFaculty} onAddingFacultyChange={setAddingFaculty} />
    </DashboardShell>
  );
}
