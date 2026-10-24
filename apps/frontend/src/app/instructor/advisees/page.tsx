'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { AdviseeSummary } from '@eduanalyze-ai/shared-types';
import { fetchAdvisees } from '@/lib/api/advisor';
import { useAuth } from '@/lib/auth-context';
import { gpaColorClassName } from '@/lib/gpa-color';
import { GRADUATION_READINESS_LABEL } from '@/lib/credit-labels';
import { cn } from '@/lib/utils';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Reveal } from '@/components/layout/reveal';
import {
  STUDENT_CARD_MAIN,
  StudentCardFrame,
  StudentCardGrid,
  StudentIdentity,
} from '@/components/instructor/student-card';
import { StudentPersonListSkeleton } from '@/components/instructor/student-person-list';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

// Below this the GPA reads red (gpaColorClassName); the card gets the same warning edge.
const LOW_GPA = 2;

// The students this instructor advises (set by STAFF), read-only, by student code.
export default function InstructorAdviseesPage() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['advisees'],
    queryFn: fetchAdvisees,
    enabled: !!user?.roles.includes('INSTRUCTOR'),
  });

  if (!user) return null;
  const advisees = query.data ?? [];

  return (
    <DashboardShell role="INSTRUCTOR" identityLabel={user.email} fullName={user.fullName}>
      <Reveal index={0}>
        <PageHeader
          title="นิสิตในที่ปรึกษา"
          description={
            query.data && advisees.length > 0
              ? `${advisees.length} คน · ดูผลการเรียนได้อย่างเดียว เจ้าหน้าที่เป็นผู้กำหนดอาจารย์ที่ปรึกษา`
              : 'นิสิตที่เจ้าหน้าที่กำหนดให้คุณเป็นอาจารย์ที่ปรึกษา (ดูผลการเรียนได้อย่างเดียว)'
          }
        />
      </Reveal>

      {query.isLoading && <StudentPersonListSkeleton />}

      {query.isError && (
        <ApiErrorAlert
          message="ไม่สามารถโหลดรายชื่อนิสิตในที่ปรึกษาได้ กรุณาลองใหม่อีกครั้ง"
          onRetry={() => void query.refetch()}
        />
      )}

      {query.data && advisees.length === 0 && (
        <Reveal index={1}>
          <Card>
            <CardContent className="pt-6">
              <EmptyState
                illustration="no-students"
                description="ยังไม่มีนิสิตในที่ปรึกษา เมื่อเจ้าหน้าที่กำหนดให้คุณเป็นอาจารย์ที่ปรึกษา รายชื่อจะขึ้นที่นี่"
              />
            </CardContent>
          </Card>
        </Reveal>
      )}

      {advisees.length > 0 && (
        <Reveal index={1}>
          <StudentCardGrid>
            {advisees.map((advisee) => (
              <li key={advisee.id}>
                <AdviseeCard advisee={advisee} />
              </li>
            ))}
          </StudentCardGrid>
        </Reveal>
      )}
    </DashboardShell>
  );
}

function AdviseeCard({ advisee }: Readonly<{ advisee: AdviseeSummary }>) {
  const lowGpa = advisee.gpa !== null && advisee.gpa < LOW_GPA;
  const gpaText = advisee.gpa === null ? '—' : advisee.gpa.toFixed(2);
  return (
    <StudentCardFrame
      accent={lowGpa ? 'danger' : null}
      accentNote={lowGpa ? `GPA ต่ำกว่า ${LOW_GPA.toFixed(2)}` : undefined}
    >
      <Link
        href={`/instructor/advisees/${advisee.id}`}
        className={cn(STUDENT_CARD_MAIN, 'flex-col items-stretch gap-3')}
        aria-label={`ดูผลการเรียนของ ${advisee.fullName} (${advisee.studentCode}) GPA ${gpaText}`}
      >
        <span className="flex items-center gap-3">
          <StudentIdentity
            name={advisee.fullName}
            code={advisee.studentCode}
            meta={`${advisee.programCode} หลักสูตร ${advisee.curriculumVersion} · เข้าปี ${advisee.admissionYear}`}
          />
          <span className="shrink-0 text-right">
            <span
              className={cn(
                'block text-2xl font-semibold tabular-nums',
                gpaColorClassName(advisee.gpa),
              )}
            >
              {gpaText}
            </span>
            <span className="block text-xs text-muted-foreground">GPA</span>
          </span>
        </span>
        <span className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-sm">
          <span className="text-muted-foreground">
            หน่วยกิตสะสม{' '}
            <span className="font-semibold tabular-nums text-primary">
              {advisee.creditsAccumulated}
            </span>{' '}
            / {advisee.totalCreditsRequired}
          </span>
          {!advisee.isActive ? (
            <Badge tone="danger">ระงับบัญชี</Badge>
          ) : (
            advisee.graduationReady && (
              <Badge tone="success">{GRADUATION_READINESS_LABEL}: พร้อม</Badge>
            )
          )}
        </span>
      </Link>
    </StudentCardFrame>
  );
}
