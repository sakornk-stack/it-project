'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  GraduationCap,
  ListChecks,
  Sigma,
  Users,
} from 'lucide-react';
import { fetchCurriculumQuality } from '@/lib/api/admin';
import { fetchCurriculum } from '@/lib/api/plo-achievement';
import { findCurriculum, placeOf } from '@/lib/admin-curricula';
import {
  LITTLE_DATA_LABEL,
  GPA_SCALE_MAX,
  formatGpa,
  gpaStatus,
  hasAnyPloData,
  hasLittleData,
  lowestPlos,
} from '@/lib/admin-curriculum-quality';
import { useAuth } from '@/lib/auth-context';
import { useCurriculumDirectory } from '@/lib/use-curriculum-directory';
import {
  CohortComparison,
  LowestSection,
  StatusCriteria,
} from '@/components/admin/curriculum-quality-sections';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { CurriculumRadarCard } from '@/components/admin/curriculum-radar-card';
import { StatCard } from '@/components/dashboard/stat-card';
import { PageLoadError } from '@/components/layout/page-states';
import { PageHeader } from '@/components/layout/page-header';
import { Reveal } from '@/components/layout/reveal';
import { RevealOnScroll } from '@/components/layout/reveal-on-scroll';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton, StatCardsSkeleton } from '@/components/ui/skeleton';

// The GPA card's status pill: a word and an icon as well as a colour.
function gpaBadge(gpa: number | null) {
  const status = gpaStatus(gpa);
  if (!status) return undefined;
  return {
    text: status.label,
    tone: status.tone,
    icon: status.tone === 'success' ? CheckCircle2 : AlertTriangle,
  };
}

export default function AdminCurriculumQualityPage() {
  const { id } = useParams<{ id: string }>();
  return <AdminCurriculumQualityContent curriculumId={id} />;
}

function AdminCurriculumQualityContent({ curriculumId }: Readonly<{ curriculumId: string }>) {
  const { user } = useAuth();
  const overviewQuery = useCurriculumDirectory();
  const qualityQuery = useQuery({
    queryKey: ['admin-curriculum-quality', curriculumId],
    queryFn: () => fetchCurriculumQuality(curriculumId),
    retry: false,
  });

  // The pass bar for the radar; the radar still draws without it while this loads or fails.
  const curriculumQuery = useQuery({
    queryKey: ['curriculum', curriculumId],
    queryFn: () => fetchCurriculum(curriculumId),
  });
  const threshold = curriculumQuery.data?.defaultAchievementThreshold ?? null;

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

  const overview = overviewQuery.data;
  const entry = overview ? findCurriculum(overview.entries, curriculumId) : null;
  const place = entry && overview ? placeOf(entry, overview.programs) : null;
  const report = qualityQuery.data;
  // The overview lists only what the requester's scope covers, so a curriculum
  // missing from it is outside that scope however the address got here.
  const outOfScope = overview !== undefined && entry === null;

  return (
    <DashboardShell role="ADMIN" identityLabel={user.email} fullName={user.fullName}>
      <Link
        href="/admin/curriculum"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        กลับไปรายการหลักสูตร
      </Link>

      {outOfScope && <PageLoadError message="ไม่พบหลักสูตรนี้ในขอบเขตที่คุณดูแล" />}
      {!outOfScope && qualityQuery.isError && (
        <PageLoadError
          message="ไม่พบหลักสูตร หรือไม่มีสิทธิ์เข้าถึงข้อมูลคุณภาพของหลักสูตรนี้"
          onRetry={() => qualityQuery.refetch()}
        />
      )}
      {!outOfScope && (qualityQuery.isLoading || overviewQuery.isLoading) && (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <StatCardsSkeleton count={4} />
        </div>
      )}

      {entry && (
        <Reveal index={0}>
          <PageHeader
            title={entry.programName}
            description={
              <span className="flex flex-col gap-2">
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">
                    {entry.programCode} · ฉบับ {entry.version} (พ.ศ. {entry.effectiveYear})
                  </Badge>
                  {report && hasLittleData(report.gpaSampleSize) && report.studentCount > 0 && (
                    <Badge tone="warning">{LITTLE_DATA_LABEL}</Badge>
                  )}
                </span>
                {place && (
                  <span>
                    {place.departmentName} · {place.facultyName}
                  </span>
                )}
              </span>
            }
          />
          <Link
            href={`/admin/curriculum/${curriculumId}/outcomes`}
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ListChecks size={14} aria-hidden="true" />
            จัดการ CLO รายวิชา
          </Link>
          <Link
            href={`/admin/curriculum/${curriculumId}/plos`}
            className="ml-4 mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ListChecks size={14} aria-hidden="true" />
            จัดการ PLO และการเชื่อม CLO↔PLO
          </Link>
        </Reveal>
      )}

      {entry && report && report.studentCount === 0 && (
        <Reveal index={1}>
          <Card>
            <CardContent className="pt-6">
              <EmptyState
                icon={Users}
                description={
                  entry.dataState === 'EMPTY'
                    ? 'หลักสูตรนี้ยังไม่มีรายวิชาและนิสิต จึงยังไม่มีข้อมูลคุณภาพให้แสดง'
                    : 'หลักสูตรนี้ยังไม่มีนิสิต จึงยังไม่มีผลการเรียนให้วิเคราะห์ — รายวิชา PLO และ CLO ที่จัดไว้จะแสดงผลเมื่อมีนิสิตลงทะเบียน'
                }
              />
            </CardContent>
          </Card>
        </Reveal>
      )}

      {entry && report && report.studentCount > 0 && (
        <>
          <Reveal index={1}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={Users}
                label="จำนวนนิสิต"
                value={<AnimatedNumber value={report.studentCount} />}
                suffix="คน"
                footer={
                  <p className="text-xs text-muted-foreground">นิสิตที่ใช้งานอยู่ในหลักสูตรนี้</p>
                }
              />
              <StatCard
                icon={Sigma}
                label="GPA เฉลี่ยสะสม"
                value={
                  report.averageGpa === null ? (
                    <span className="text-lg font-medium">ยังไม่มีข้อมูล</span>
                  ) : (
                    <AnimatedNumber value={report.averageGpa} decimals={2} format={formatGpa} />
                  )
                }
                suffix={report.averageGpa === null ? undefined : `/ ${GPA_SCALE_MAX.toFixed(2)}`}
                badge={gpaBadge(report.averageGpa)}
                footer={
                  <p className="text-xs text-muted-foreground tabular-nums">
                    คำนวณจากนิสิตที่มีเกรด {report.gpaSampleSize} จาก {report.studentCount} คน
                  </p>
                }
              />
              <StatCard
                icon={GraduationCap}
                label="พร้อมจบการศึกษา"
                value={<AnimatedNumber value={report.graduationReadyCount} />}
                suffix="คน"
                footer={
                  report.graduationReadyPercent === null ? null : (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      ร้อยละ {report.graduationReadyPercent.toFixed(1)} ของนิสิตทั้งหมด
                    </p>
                  )
                }
              />
              <StatCard
                icon={report.studentsAtRiskCount > 0 ? AlertTriangle : CheckCircle2}
                label="ต้องติดตาม"
                value={<AnimatedNumber value={report.studentsAtRiskCount} />}
                suffix="คน"
                badge={
                  report.studentsAtRiskCount > 0
                    ? { text: 'ควรติดตาม', tone: 'danger', icon: AlertTriangle }
                    : { text: 'ปกติ', tone: 'success', icon: CheckCircle2 }
                }
                footer={
                  <p className="text-xs text-muted-foreground">
                    {report.studentsAtRiskCount > 0
                      ? 'เร่งด่วนและเฝ้าระวัง ตามเกณฑ์ด้านล่าง'
                      : 'ไม่มีนิสิตที่ GPA ต่ำกว่าเกณฑ์'}
                  </p>
                }
              />
            </div>
          </Reveal>

          <Reveal index={2}>
            <StatusCriteria />
          </Reveal>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="space-y-4 xl:col-span-2">
              <RevealOnScroll>
                {hasAnyPloData(report.radar) ? (
                  <CurriculumRadarCard radar={report.radar} threshold={threshold} />
                ) : (
                  <Card>
                    <CardContent className="pt-6">
                      <EmptyState
                        icon={Sigma}
                        description="ยังไม่มีผลการประเมิน PLO ของนิสิตในหลักสูตรนี้ จึงยังไม่แสดงเรดาร์"
                      />
                    </CardContent>
                  </Card>
                )}
              </RevealOnScroll>
              <RevealOnScroll>
                <LowestSection
                  plos={lowestPlos(report.radar)}
                  clos={report.lowestClos}
                  threshold={threshold}
                />
              </RevealOnScroll>
            </div>
            <RevealOnScroll>
              <CohortComparison cohorts={report.cohortComparison} />
            </RevealOnScroll>
          </div>
        </>
      )}
    </DashboardShell>
  );
}
