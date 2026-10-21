'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchOwnStudentProfile } from '@/lib/api/dashboard';
import { fetchStudentPloAchievement, fetchCurriculum } from '@/lib/api/plo-achievement';
import { interpretPloRadar } from '@/lib/interpret-plo-radar';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/layout/reveal';
import { PageLoadError } from '@/components/layout/page-states';
import { PloRadarChart } from '@/components/aptitude-analysis/plo-radar-chart';
import { PloInterpretationCard } from '@/components/aptitude-analysis/plo-interpretation-card';
import { AptitudeAnalysisSkeleton } from '@/components/aptitude-analysis/aptitude-analysis-skeleton';
import { PloRadarLegend } from '@/components/aptitude-analysis/plo-radar-legend';
import { PloMethodNote } from '@/components/clo-plo-analysis/plo-method-note';
import { NoPloNotice } from '@/components/clo-plo-analysis/no-plo-notice';
import { isPreliminaryCloCurriculum } from '@/lib/plo-notes';
import { CareerFitCard } from '@/components/career-fit/career-fit-card';
import { Skeleton } from '@/components/ui/skeleton';

export default function AptitudeAnalysisPage() {
  const { user } = useAuth();

  const profileQuery = useQuery({
    queryKey: ['student-profile-me'],
    queryFn: fetchOwnStudentProfile,
  });
  const studentProfileId = profileQuery.data?.id;
  const curriculumId = profileQuery.data?.curriculumId;

  const ploQuery = useQuery({
    queryKey: ['student-plo-achievement', studentProfileId],
    queryFn: () => fetchStudentPloAchievement(studentProfileId!),
    enabled: !!studentProfileId,
  });

  const curriculumQuery = useQuery({
    queryKey: ['curriculum', curriculumId],
    queryFn: () => fetchCurriculum(curriculumId!),
    enabled: !!curriculumId,
  });

  if (!user) return null;

  const skeleton = <AptitudeAnalysisSkeleton />;

  if (profileQuery.isLoading || ploQuery.isLoading || curriculumQuery.isLoading) {
    return (
      <DashboardShell
        studentCode={profileQuery.data?.studentCode ?? ''}
        fullName={user.fullName}
        skeleton={skeleton}
        ready={false}
      >
        {null}
      </DashboardShell>
    );
  }

  if (
    profileQuery.isError ||
    ploQuery.isError ||
    curriculumQuery.isError ||
    !profileQuery.data ||
    !ploQuery.data ||
    !curriculumQuery.data
  ) {
    return (
      <DashboardShell studentCode={profileQuery.data?.studentCode ?? ''} fullName={user.fullName}>
        <PageLoadError
          onRetry={() => {
            profileQuery.refetch();
            ploQuery.refetch();
            curriculumQuery.refetch();
          }}
        />
      </DashboardShell>
    );
  }

  const interpretation = interpretPloRadar(
    ploQuery.data.radar,
    curriculumQuery.data.defaultAchievementThreshold,
  );

  return (
    <DashboardShell
      studentCode={profileQuery.data.studentCode}
      fullName={user.fullName}
      skeleton={skeleton}
    >
      <PageHeader
        title="สรุปความถนัด"
        description="สรุปจุดเด่นและจุดที่ควรพัฒนาจากผลลัพธ์การเรียนรู้ระดับหลักสูตร (PLO) ของนิสิต ไม่ต้องทำแบบทดสอบเพิ่ม"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/clo-plo-analysis">ดูรายละเอียดราย PLO/CLO</Link>
          </Button>
        }
      />

      {ploQuery.data.radar.length === 0 ? (
        <Reveal index={1}>
          <NoPloNotice />
        </Reveal>
      ) : (
        <Reveal index={1} className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <PloRadarChart
              radar={ploQuery.data.radar}
              threshold={curriculumQuery.data.defaultAchievementThreshold}
              footer={
                <div className="space-y-4">
                  <PloRadarLegend threshold={curriculumQuery.data.defaultAchievementThreshold} />
                  <PloMethodNote
                  radar={ploQuery.data.radar}
                  showThreshold
                  showCoverage
                  preliminary={isPreliminaryCloCurriculum(curriculumQuery.data)}
                  />
                </div>
              }
            />
          </div>
          <div className="lg:col-span-3">
            <PloInterpretationCard report={interpretation} />
          </div>
        </Reveal>
      )}

      <Reveal index={2} className="mt-6">
        <CareerFitCard />
      </Reveal>
    </DashboardShell>
  );
}
