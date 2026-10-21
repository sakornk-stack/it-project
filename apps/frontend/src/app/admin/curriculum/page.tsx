'use client';

import { useMemo, useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { countByTab, filterCurricula, type CurriculumTab } from '@/lib/admin-curricula';
import { useAuth } from '@/lib/auth-context';
import { useCurriculumDirectory } from '@/lib/use-curriculum-directory';
import { AdminCurriculumCards, CurriculumTabs } from '@/components/admin/admin-curriculum-cards';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-states';
import { Reveal } from '@/components/layout/reveal';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { AuthLoadingScreen } from '@/components/auth/auth-loading-screen';
import { StatCardsSkeleton } from '@/components/ui/skeleton';

export default function AdminCurriculumListPage() {
  return <AdminCurriculumListContent />;
}

function AdminCurriculumListContent() {
  const { user } = useAuth();
  const [tab, setTab] = useState<CurriculumTab>('ALL');
  const [search, setSearch] = useState('');
  const overviewQuery = useCurriculumDirectory();
  const data = overviewQuery.data;
  const entries = data?.entries;
  const tabCounts = useMemo(() => countByTab(entries ?? []), [entries]);
  const visible = useMemo(
    () => filterCurricula(entries ?? [], tab, search),
    [entries, tab, search],
  );

  if (!user) return <AuthLoadingScreen />;

  return (
    <DashboardShell role="ADMIN" identityLabel={user.email} fullName={user.fullName}>
      <Reveal index={0}>
        <PageHeader
          title="คุณภาพหลักสูตร"
          description="เลือกหลักสูตรในขอบเขตที่คุณดูแลเพื่อดูผลลัพธ์การเรียนรู้ (PLO) และสถานะนิสิต"
        />
      </Reveal>

      {overviewQuery.isLoading && <StatCardsSkeleton count={3} />}
      {overviewQuery.isError && <PageLoadError onRetry={() => overviewQuery.refetch()} />}

      {data?.isEmpty && (
        <EmptyState
          icon={ShieldCheck}
          title="ยังไม่ได้รับมอบขอบเขต"
          description="บัญชีนี้ยังไม่มีคณะ ภาควิชา หรือสาขาในความดูแล ติดต่อผู้ดูแลระบบสูงสุดเพื่อขอมอบขอบเขต"
        />
      )}

      {data && !data.isEmpty && (
        <Reveal index={1}>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CurriculumTabs value={tab} counts={tabCounts} onChange={setTab} />
              <label className="relative block lg:w-80">
                <span className="sr-only">ค้นหาหลักสูตร</span>
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหาชื่อสาขา รหัส หรือฉบับ"
                />
              </label>
            </div>
            <AdminCurriculumCards
              entries={visible}
              programs={data.programs}
              filtered={tab !== 'ALL' || search.trim() !== ''}
            />
          </div>
        </Reveal>
      )}
    </DashboardShell>
  );
}
