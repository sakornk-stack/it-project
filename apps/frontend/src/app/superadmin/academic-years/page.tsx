'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Info, Plus } from 'lucide-react';
import { fetchAcademicYears, fetchSemesters } from '@/lib/api/academic-record';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-states';
import { PageSection } from '@/components/layout/page-section';
import { Reveal } from '@/components/layout/reveal';
import { AcademicYearForm } from '@/components/admin/academic-year-form';
import { BulkAcademicYearForm } from '@/components/admin/bulk-academic-year-form';
import { AcademicYearCard } from '@/components/admin/academic-year-card';
import { AcademicYearInactiveSection } from '@/components/admin/academic-year-inactive-section';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState, InlineNotice } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

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
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={openForm === 'bulk' ? 'default' : 'outline'}
                className="gap-1.5"
                onClick={() => toggleForm('bulk')}
              >
                <Plus size={16} />
                สร้างหลายปี
              </Button>
              <Button
                type="button"
                variant={openForm === 'single' ? 'default' : 'outline'}
                className="gap-1.5"
                onClick={() => toggleForm('single')}
              >
                <Plus size={16} />
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

      <Reveal index={1}>
        <InlineNotice icon={Info}>
          ปีการศึกษาหนึ่งมีได้สูงสุด 3 ภาคเรียน (ภาคต้น ภาคปลาย ภาคฤดูร้อน)
          ปิดใช้งานปีการศึกษาได้เมื่อไม่มีภาคเรียนที่ใช้งานอยู่
          และปิดใช้งานภาคเรียนได้เมื่อไม่มีผลการเรียนอ้างอิง ทั้งสองอย่างเปิดคืนจากหน้าจอไม่ได้
        </InlineNotice>
      </Reveal>

      <Reveal index={2}>
        <PageSection
          title="ปีการศึกษาทั้งหมด"
          actions={
            <Button
              type="button"
              variant={showInactive ? 'default' : 'outline'}
              size="sm"
              aria-pressed={showInactive}
              onClick={() => setShowInactive((open) => !open)}
            >
              {showInactive ? 'ซ่อนที่ปิดใช้งาน' : 'แสดงที่ปิดใช้งาน'}
            </Button>
          }
        >
          {(yearsQuery.isLoading || semestersQuery.isLoading) && (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-5 w-32" />
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </CardContent>
                </Card>
              ))}
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setOpenForm('single')}
                    >
                      <Plus size={16} />
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
