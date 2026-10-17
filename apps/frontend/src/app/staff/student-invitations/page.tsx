'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import {
  fetchStaffOverview,
  fetchStaffStudentRisk,
  fetchStudentInvitations,
} from '@/lib/api/staff';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { StudentsTabs } from '@/components/staff/students-tabs';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-states';
import { PageSection } from '@/components/layout/page-section';
import { Reveal } from '@/components/layout/reveal';
import { StudentInvitationCsvPanel } from '@/components/staff/student-invitation-csv-panel';
import { StudentInvitationList } from '@/components/staff/student-invitation-list';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function StaffStudentInvitationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCsvPanel, setShowCsvPanel] = useState(false);

  const overviewQuery = useQuery({
    queryKey: ['staff-overview'],
    queryFn: fetchStaffOverview,
  });
  // Only for the count on the first tab; the other pages already hold this list.
  const studentsQuery = useQuery({
    queryKey: ['staff-student-risk'],
    queryFn: fetchStaffStudentRisk,
  });
  const invitationsQuery = useQuery({
    queryKey: ['student-invitations'],
    queryFn: fetchStudentInvitations,
  });

  function refetchInvitations() {
    queryClient.invalidateQueries({ queryKey: ['student-invitations'] });
  }

  if (!user) return null;

  return (
    <DashboardShell role="STAFF" identityLabel={user.email} fullName={user.fullName}>
      <Reveal index={0}>
        <PageHeader
          title="นิสิต"
          description="นำเข้ารายชื่อนิสิตที่จะเข้าศึกษาจากไฟล์ CSV — ระบบส่งอีเมลเชิญให้แต่ละคน ผู้ถูกเชิญยังต้องสมัครสมาชิกด้วยตนเอง"
          actions={
            <Button
              type="button"
              variant={showCsvPanel ? 'outline' : 'default'}
              className="gap-1.5 px-4"
              onClick={() => setShowCsvPanel((open) => !open)}
            >
              {showCsvPanel ? (
                'ยกเลิก'
              ) : (
                <>
                  <Plus size={16} />
                  นำเข้าจาก CSV
                </>
              )}
            </Button>
          }
        />
      </Reveal>

      <Reveal index={0}>
        <StudentsTabs active="invitations" count={studentsQuery.data?.length} />
      </Reveal>

      {overviewQuery.isLoading && <Skeleton className="h-32 w-full" />}
      {overviewQuery.isError && (
        <PageLoadError
          message="ไม่สามารถโหลดข้อมูลสาขาที่คุณดูแลได้"
          onRetry={() => overviewQuery.refetch()}
        />
      )}

      {showCsvPanel && overviewQuery.data && (
        <Reveal>
          <StudentInvitationCsvPanel
            overview={overviewQuery.data}
            onInvited={refetchInvitations}
            onClose={() => setShowCsvPanel(false)}
          />
        </Reveal>
      )}

      <Reveal index={1}>
        <PageSection title="คำเชิญที่ค้างอยู่">
          {invitationsQuery.isLoading && <Skeleton className="h-40 w-full" />}
          {invitationsQuery.isError && <PageLoadError onRetry={() => invitationsQuery.refetch()} />}
          {invitationsQuery.data && (
            <StudentInvitationList
              invitations={invitationsQuery.data}
              onChanged={refetchInvitations}
              onInviteClick={() => setShowCsvPanel(true)}
            />
          )}
        </PageSection>
      </Reveal>
    </DashboardShell>
  );
}
