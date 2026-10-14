'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CalendarRange, Layers, Plus } from 'lucide-react';
import { fetchAcademicYears, fetchSemesters } from '@/lib/api/academic-record';
import { SEMESTER_TERM_LABELS } from '@/lib/grade-label';
import { useAuth } from '@/lib/auth-context';
import { StatCard } from '@/components/dashboard/stat-card';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-states';
import { PageSection } from '@/components/layout/page-section';
import { Reveal } from '@/components/layout/reveal';
import { AcademicYearForm } from '@/components/admin/academic-year-form';
import { BulkAcademicYearForm } from '@/components/admin/bulk-academic-year-form';
import { AcademicYearCard, AcademicYearCardSkeleton } from '@/components/admin/academic-year-card';
import { AcademicYearInactiveSection } from '@/components/admin/academic-year-inactive-section';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton, StatCardsSkeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

// Derived from the terms the system knows, same as the year card.
const MAX_TERMS_PER_YEAR = Object.keys(SEMESTER_TERM_LABELS).length;

export default function AcademicYearsAdminPage() {
  return <AcademicYearsAdminContent />;
}

function AcademicYearsAdminContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [openForm, setOpenForm] = useState<'bulk' | 'single' | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const yearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: fetchAcademicYears });
  const semestersQuery = useQuery({ queryKey: ['semesters'], queryFn: fetchSemesters });

  // Same rule the backend uses for a student's year level (highest year on
  // file); there is no stored "current year" field.
  const latestYear = Math.max(0, ...(yearsQuery.data ?? []).map((y) => y.year));

  const statsLoading = yearsQuery.isLoading || semestersQuery.isLoading;

  function refetchAll() {
    queryClient.invalidateQueries({ queryKey: ['academic-years'] });
    queryClient.invalidateQueries({ queryKey: ['semesters'] });
  }

  function toggleForm(form: 'bulk' | 'single') {
    setOpenForm((current) => (current === form ? null : form));
  }

  function handleSingleCreated() {
    setOpenForm(null);
    refetchAll();
  }

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
          title="ปีการศึกษาและภาคเรียน"
          description="จัดการปีการศึกษาและภาคเรียนที่ใช้ทั่วทั้งระบบ"
          actions={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className={cn('min-h-11 gap-1.5', openForm === 'bulk' && 'bg-accent')}
                aria-expanded={openForm === 'bulk'}
                onClick={() => toggleForm('bulk')}
              >
                <Plus size={16} aria-hidden="true" />
                สร้างหลายปี
              </Button>
              <Button
                type="button"
                className="min-h-11 gap-1.5"
                aria-expanded={openForm === 'single'}
                onClick={() => toggleForm('single')}
              >
                <Plus size={16} aria-hidden="true" />
                เพิ่มปีการศึกษา
              </Button>
            </div>
          }
        />
      </Reveal>

      {/* Bulk stays open after submit: it renders a per-year created/skipped
          table that closing it would throw away. */}
      {openForm === 'bulk' && (
        <Reveal className="space-y-2">
          <BulkAcademicYearForm onCreated={refetchAll} />
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpenForm(null)}>
            ปิดฟอร์ม
          </Button>
        </Reveal>
      )}
      {openForm === 'single' && (
        <Reveal>
          <AcademicYearForm onCreated={handleSingleCreated} />
        </Reveal>
      )}

      {statsLoading && <StatCardsSkeleton count={3} />}
      {yearsQuery.data && semestersQuery.data && (
        <Reveal index={1}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              large
              interactive={false}
              tone="primary"
              icon={CalendarDays}
              label="ปีการศึกษาที่ใช้งาน"
              value={yearsQuery.data.length}
              suffix="ปี"
            />
            <StatCard
              large
              interactive={false}
              tone="primary"
              icon={CalendarRange}
              label="ปีล่าสุด"
              value={yearsQuery.data.length > 0 ? latestYear : '-'}
            />
            <StatCard
              large
              interactive={false}
              tone="primary"
              icon={Layers}
              label="ภาคเรียนที่ใช้งานรวม"
              value={semestersQuery.data.length}
              suffix="ภาค"
            />
          </div>
        </Reveal>
      )}

      <Reveal index={2}>
        <PageSection
          title="ปีการศึกษาทั้งหมด"
          description={`ปีการศึกษาหนึ่งมีได้ไม่เกิน ${MAX_TERMS_PER_YEAR} ภาคเรียน · ปิดใช้งานปีได้เมื่อไม่มีภาคเรียนที่ใช้งานอยู่`}
          actions={
            <Switch checked={showInactive} onCheckedChange={setShowInactive}>
              แสดงที่ปิดใช้งาน
            </Switch>
          }
        >
          {(yearsQuery.isLoading || semestersQuery.isLoading) && (
            <div className="space-y-4">
              <AcademicYearCardSkeleton rows={3} />
              <AcademicYearCardSkeleton />
            </div>
          )}

          {(yearsQuery.isError || semestersQuery.isError) && (
            <PageLoadError
              onRetry={() => {
                yearsQuery.refetch();
                semestersQuery.refetch();
              }}
            />
          )}

          {yearsQuery.data && semestersQuery.data && (
            <div className="space-y-4">
              {yearsQuery.data.length === 0 ? (
                <EmptyState
                  illustration="no-data"
                  description="ยังไม่มีปีการศึกษาในระบบ"
                  action={
                    <Button type="button" className="gap-1.5" onClick={() => setOpenForm('single')}>
                      <Plus size={16} aria-hidden="true" />
                      เพิ่มปีการศึกษา
                    </Button>
                  }
                />
              ) : (
                [...yearsQuery.data]
                  .sort((a, b) => b.year - a.year)
                  .map((year, index) => (
                    <AcademicYearCard
                      key={year.id}
                      defaultOpen={index === 0}
                      academicYear={year}
                      semesters={semestersQuery.data.filter((s) => s.academicYearId === year.id)}
                      isLatest={year.year === latestYear}
                      onChanged={refetchAll}
                    />
                  ))
              )}
            </div>
          )}
        </PageSection>
        {showInactive && (
          <PageSection
            className="pt-6"
            title="ที่ปิดใช้งาน"
            description="ปีการศึกษาและภาคเรียนที่ปิดใช้งานไปแล้ว เปิดกลับมาใช้งานได้ที่นี่"
          >
            <AcademicYearInactiveSection />
          </PageSection>
        )}
      </Reveal>
    </DashboardShell>
  );
}
