'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, ShieldCheck, UserCog } from 'lucide-react';
import { fetchAdminScopeOverview } from '@/lib/api/admin';
import { fetchUser } from '@/lib/api/user-management';
import { SCOPE_LEVEL_LABELS } from '@/lib/scope-labels';
import { useScopeTargetName } from '@/lib/use-scope-target-name';
import { countByTab, filterCurricula, type CurriculumTab } from '@/lib/admin-curricula';
import { useAuth } from '@/lib/auth-context';
import { ScopeBreadcrumb } from '@/components/admin/scope-breadcrumb';
import { AdminCurriculumCards, CurriculumTabs } from '@/components/admin/admin-curriculum-cards';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { StatCard } from '@/components/dashboard/stat-card';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-states';
import { PageSection } from '@/components/layout/page-section';
import { Reveal } from '@/components/layout/reveal';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { EmptyState } from '@/components/ui/empty-state';
import { AuthLoadingScreen } from '@/components/auth/auth-loading-screen';
import { StatCardsSkeleton } from '@/components/ui/skeleton';

// The overview shows the first few curricula; the full list is /admin/curriculum.
const PREVIEW_LIMIT = 6;

export default function AdminOverviewPage() {
  return <AdminOverviewContent />;
}

function AdminOverviewContent() {
  const { user } = useAuth();
  const [tab, setTab] = useState<CurriculumTab>('ALL');
  const overviewQuery = useQuery({
    queryKey: ['admin-scope-overview'],
    queryFn: fetchAdminScopeOverview,
  });
  // The scope itself (level + unit name), not the parent faculty it sits under.
  const ownUserQuery = useQuery({
    queryKey: ['admin-users', user?.userId],
    queryFn: () => fetchUser(user!.userId),
    enabled: !!user,
  });
  const resolveTargetName = useScopeTargetName();
  const ownScopes = ownUserQuery.data?.scopes ?? [];
  const data = overviewQuery.data;
  const entries = data?.curricula.entries;
  const tabCounts = useMemo(() => countByTab(entries ?? []), [entries]);
  const visible = useMemo(() => filterCurricula(entries ?? [], tab, ''), [entries, tab]);

  if (!user) return <AuthLoadingScreen />;

  const isEmptyScope = data && data.scope.programCount === 0;
  return (
    <DashboardShell role="ADMIN" identityLabel={user.email} fullName={user.fullName}>
      <Reveal index={0}>
        <PageHeader
          title="ภาพรวมขอบเขต"
          description="หน่วยงาน ผู้ใช้งาน และหลักสูตรในขอบเขตที่คุณดูแล"
          actions={
            ownScopes.length > 0 && (
              <div className="rounded-lg border bg-card px-4 py-2 text-sm">
                <p className="text-xs text-muted-foreground">ขอบเขตที่รับผิดชอบ</p>
                <ul className="space-y-0.5">
                  {ownScopes.map((scope) => (
                    <li key={scope.id} className="break-words font-semibold text-primary">
                      {SCOPE_LEVEL_LABELS[scope.level]}: {resolveTargetName(scope)}
                    </li>
                  ))}
                </ul>
              </div>
            )
          }
        />
      </Reveal>

      {overviewQuery.isLoading && <StatCardsSkeleton count={3} />}
      {overviewQuery.isError && <PageLoadError onRetry={() => overviewQuery.refetch()} />}

      {isEmptyScope && (
        <Reveal index={1}>
          <EmptyState
            icon={ShieldCheck}
            description="บัญชีนี้ยังไม่ได้รับมอบขอบเขต (คณะ/ภาควิชา/สาขา) ใดๆ — ติดต่อผู้ดูแลระบบสูงสุดเพื่อขอมอบขอบเขต"
          />
        </Reveal>
      )}

      {data && !isEmptyScope && (
        <>
          <Reveal index={1}>
            <PageSection
              title="หน่วยงานในขอบเขตของคุณ"
              description="นับคณะและภาควิชาต้นสังกัดของสาขาในขอบเขต"
            >
              <ScopeBreadcrumb
                counts={{
                  faculty: data.scope.facultyCount,
                  department: data.scope.departmentCount,
                  program: data.scope.programCount,
                }}
              />
            </PageSection>
          </Reveal>

          <Reveal index={2}>
            <PageSection
              title="สรุปจำนวนผู้ใช้งานแยกตามบทบาท"
              description="เฉพาะบัญชีที่ใช้งานอยู่ในขอบเขตของคุณ"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <StatCard
                  compact
                  icon={UserCog}
                  label="เจ้าหน้าที่"
                  value={<AnimatedNumber value={data.userCounts.staff} />}
                  suffix="คน"
                />
                <StatCard
                  compact
                  icon={ShieldCheck}
                  label="ผู้ดูแลระบบ"
                  value={<AnimatedNumber value={data.userCounts.admin} />}
                  suffix="คน"
                />
                <StatCard
                  compact
                  icon={GraduationCap}
                  label="นิสิต"
                  value={<AnimatedNumber value={data.userCounts.student} />}
                  suffix="คน"
                />
              </div>
            </PageSection>
          </Reveal>

          <Reveal index={3}>
            <PageSection
              title="หลักสูตรในความดูแล"
              description={`ทั้งหมด ${data.curricula.totalCount} หลักสูตร`}
              actions={
                <Link
                  href="/admin/curriculum"
                  className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline"
                >
                  ดูหลักสูตรทั้งหมด
                </Link>
              }
            >
              <CurriculumTabs value={tab} counts={tabCounts} onChange={setTab} />
              <AdminCurriculumCards
                entries={visible.slice(0, PREVIEW_LIMIT)}
                programs={data.scope.programs}
                filtered={tab !== 'ALL'}
              />
              {visible.length > PREVIEW_LIMIT && (
                <p className="text-sm text-muted-foreground">
                  แสดง {PREVIEW_LIMIT} จาก {visible.length} หลักสูตร —{' '}
                  <Link href="/admin/curriculum" className="font-medium text-brand hover:underline">
                    ดูทั้งหมด
                  </Link>
                </p>
              )}
            </PageSection>
          </Reveal>
        </>
      )}
    </DashboardShell>
  );
}
