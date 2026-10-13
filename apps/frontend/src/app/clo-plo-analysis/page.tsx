'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchOwnStudentProfile } from '@/lib/api/dashboard';
import {
  fetchCurriculum,
  fetchPlos,
  fetchStudentPloAchievement,
} from '@/lib/api/plo-achievement';
import { useAuth } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { PageSection } from '@/components/layout/page-section';
import { Reveal } from '@/components/layout/reveal';
import { PageLoadError, StudentOnlyPage } from '@/components/layout/page-states';
import { OverallAchievementCard } from '@/components/clo-plo-analysis/overall-achievement-card';
import { PloCard } from '@/components/clo-plo-analysis/plo-card';
import { SCORE_BANDS, scoreBandKey } from '@/lib/plo-score-bands';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type SortMode = 'lowest' | 'highest' | 'code';

export default function CloPloAnalysisPage() {
  return (
    <ProtectedRoute>
      <CloPloAnalysisContent />
    </ProtectedRoute>
  );
}

function CloPloAnalysisContent() {
  const { user } = useAuth();
  const isStudent = !!user?.roles.includes('STUDENT');
  const [sortMode, setSortMode] = useState<SortMode>('lowest');
  // PLO cards currently expanded. While any is open the grid stops stretching rows,
  // so an open card grows in its own column without stretching its neighbour.
  const [expandedPloIds, setExpandedPloIds] = useState<ReadonlySet<string>>(new Set());
  const handleExpandedChange = (ploId: string, expanded: boolean) =>
    setExpandedPloIds((prev) => {
      const next = new Set(prev);
      if (expanded) next.add(ploId);
      else next.delete(ploId);
      return next;
    });

  const profileQuery = useQuery({
    queryKey: ['student-profile-me'],
    queryFn: fetchOwnStudentProfile,
    enabled: isStudent,
  });
  const studentProfileId = profileQuery.data?.id;
  const curriculumId = profileQuery.data?.curriculumId;

  const achievementQuery = useQuery({
    queryKey: ['student-plo-achievement', studentProfileId],
    queryFn: () => fetchStudentPloAchievement(studentProfileId!),
    enabled: !!studentProfileId,
  });
  const plosQuery = useQuery({ queryKey: ['plos'], queryFn: fetchPlos, enabled: !!studentProfileId });
  const curriculumQuery = useQuery({
    queryKey: ['curriculum', curriculumId],
    queryFn: () => fetchCurriculum(curriculumId!),
    enabled: !!curriculumId,
  });

  const descriptionByPloId = useMemo(
    () => new Map((plosQuery.data ?? []).map((p) => [p.id, p.description])),
    [plosQuery.data],
  );

  const threshold = curriculumQuery.data?.defaultAchievementThreshold ?? null;

  // Lowest achievement first — surfaces what needs work before what's
  // already fine. PLOs with no data (null) go last: "no data" isn't the
  // same signal as "needs improvement", so it shouldn't compete for the
  // top of the list.
  const sortedRadar = useMemo(() => {
    const radar = achievementQuery.data?.radar ?? [];
    return [...radar].sort((a, b) => {
      if (a.value === null && b.value === null) return 0;
      if (a.value === null) return 1;
      if (b.value === null) return -1;
      if (sortMode === 'highest') return b.value - a.value;
      if (sortMode === 'code') return a.code.localeCompare(b.code);
      return a.value - b.value;
    });
  }, [achievementQuery.data, sortMode]);

  const overallPercent = useMemo(() => {
    const values = (achievementQuery.data?.radar ?? [])
      .map((p) => p.value)
      .filter((v): v is number => v !== null);
    if (values.length === 0) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }, [achievementQuery.data]);

  // Display-only grouping for the summary card. Raw achievement values,
  // curriculum threshold, and achieved/not-achieved logic remain unchanged.
  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(SCORE_BANDS.map((band) => [band.key, 0])) as Record<
      (typeof SCORE_BANDS)[number]['key'],
      number
    >;
    let noDataCount = 0;
    for (const plo of achievementQuery.data?.radar ?? []) {
      if (plo.value === null) {
        noDataCount += 1;
      } else {
        counts[scoreBandKey(plo.value)] += 1;
      }
    }
    return { counts, noDataCount };
  }, [achievementQuery.data]);

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

  if (!isStudent) {
    return <StudentOnlyPage user={user} />;
  }

  const isLoading =
    profileQuery.isLoading || achievementQuery.isLoading || plosQuery.isLoading || curriculumQuery.isLoading;

  const skeleton = (
    <>
      <Card>
        <CardContent className="grid grid-cols-1 items-center gap-8 pt-6 sm:grid-cols-[auto_1fr]">
          <Skeleton className="mx-auto h-28 w-28 rounded-full" />
          <div className="space-y-3">
            <Skeleton className="h-2.5 w-full rounded-full" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
    </>
  );

  if (isLoading) {
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
    achievementQuery.isError ||
    plosQuery.isError ||
    curriculumQuery.isError ||
    !profileQuery.data ||
    !achievementQuery.data
  ) {
    return (
      <DashboardShell studentCode={profileQuery.data?.studentCode ?? ''} fullName={user.fullName}>
        <PageLoadError
          onRetry={() => {
            profileQuery.refetch();
            achievementQuery.refetch();
            plosQuery.refetch();
            curriculumQuery.refetch();
          }}
        />
      </DashboardShell>
    );
  }

  const overallAchieved = threshold !== null && overallPercent !== null && overallPercent >= threshold;

  return (
    <DashboardShell
      studentCode={profileQuery.data.studentCode}
      fullName={user.fullName}
      skeleton={skeleton}
    >
      <>
        <PageHeader
          title="การวิเคราะห์ CLO/PLO"
          description="ความสำเร็จของผลลัพธ์การเรียนรู้ระดับหลักสูตร (PLO) จากผลการเรียนของคุณ"
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href="/aptitude-analysis">ดูสรุปความถนัด</Link>
            </Button>
          }
        />

        <Reveal index={1}>
          <OverallAchievementCard
            percent={overallPercent}
            isAchieved={overallAchieved}
            threshold={threshold}
            bandCounts={statusCounts.counts}
            noDataCount={statusCounts.noDataCount}
          />
        </Reveal>

        <Reveal index={2}>
          <PageSection
            title="ผลการวิเคราะห์ราย PLO"
            description="คลิกแต่ละ PLO เพื่อดูผลลัพธ์การเรียนรู้ระดับรายวิชา (CLO) ที่เกี่ยวข้อง"
            actions={
              <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                <SelectTrigger aria-label="เรียงลำดับ PLO" className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lowest">เรียง: ต้องพัฒนาก่อน</SelectItem>
                  <SelectItem value="highest">เรียง: คะแนนสูงสุด</SelectItem>
                  <SelectItem value="code">เรียงตาม PLO</SelectItem>
                </SelectContent>
              </Select>
            }
          >
            <div
                className={`grid grid-cols-1 gap-4 lg:grid-cols-2 ${
                  expandedPloIds.size > 0 ? 'items-start' : 'items-stretch'
                }`}
              >
              {sortedRadar.map((plo) => (
                <PloCard
                  key={plo.ploId}
                  plo={plo}
                  description={descriptionByPloId.get(plo.ploId) ?? null}
                  isAchieved={threshold !== null && plo.value !== null && plo.value >= threshold}
                  threshold={threshold}
                  expanded={expandedPloIds.has(plo.ploId)}
                  onExpandedChange={handleExpandedChange}
                />
              ))}
            </div>
          </PageSection>
        </Reveal>
      </>
    </DashboardShell>
  );
}
