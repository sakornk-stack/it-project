'use client';

import { useMemo } from 'react';
import type {
  CloAchievementEntry,
  CoursePloEntry,
  CourseCloAchievementReport,
} from '@eduanalyze-ai/shared-types';
import { SPARSE_SUMMARY, dataLevelOf } from '@/lib/course-snapshot';
import { ploProgressBarColorClassName } from '@/lib/plo-color';
import { formatPercent } from '@/lib/format-percent';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { PageSection } from '@/components/layout/page-section';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { EvidenceCoverageBadge } from './evidence-coverage-badge';
import { LowSampleTag } from './overview-parts';

interface CourseAssessmentSummary {
  courseId: string;
  submissionCount: number;
  clos: { cloId: string; code: string; averageScore: number | null; scoreCount: number }[];
}

export function CloAchievementSection({
  gradedPeople,
  achievementPercent,
  clos,
  plos,
  courseAssessment,
  detail,
  isLoading,
  isError,
  evidenceCoverage,
  evidenceTotal,
  evidenceError,
}: Readonly<{
  // People counted in the B-or-above share (W and I left out): how much the
  // share can be trusted.
  gradedPeople: number;
  achievementPercent: number;
  clos: CloAchievementEntry[];
  plos: CoursePloEntry[];
  courseAssessment: CourseAssessmentSummary;
  detail: CourseCloAchievementReport | undefined;
  isLoading: boolean;
  isError: boolean;
  // Per-CLO count of students with a graded score. Sits *beside* the
  // grade-based percentages above — never replaces them: there is no
  // course-level evidence endpoint, and computing that percentage in the
  // browser would fork the backend's Decimal arithmetic. See
  // lib/evidence-coverage.ts.
  evidenceCoverage: Map<string, number> | undefined;
  evidenceTotal: number | undefined;
  evidenceError: boolean;
}>) {
  const level = dataLevelOf(gradedPeople);
  const sortedClos = useMemo(
    () => [...clos].sort((a, b) => a.code.localeCompare(b.code, 'th', { numeric: true })),
    [clos],
  );

  const scoredAssessmentClos = useMemo(
    () => courseAssessment.clos.filter((c) => c.averageScore !== null && c.scoreCount > 0),
    [courseAssessment.clos],
  );
  const lowestAssessmentCloId = useMemo(
    () =>
      scoredAssessmentClos.length === 0
        ? null
        : scoredAssessmentClos.reduce(
            (min, c) => (c.averageScore! < min.averageScore! ? c : min),
            scoredAssessmentClos[0],
          ).cloId,
    [scoredAssessmentClos],
  );
  const highestAssessmentCloId = useMemo(
    () =>
      scoredAssessmentClos.length === 0
        ? null
        : scoredAssessmentClos.reduce(
            (max, c) => (c.averageScore! > max.averageScore! ? c : max),
            scoredAssessmentClos[0],
          ).cloId,
    [scoredAssessmentClos],
  );

  return (
    <div className="space-y-5">
      <PageSection title="ภาพรวมเป้าการเรียนรู้">
        {level === 'insufficient' ? (
          <p className="text-sm text-muted-foreground">{SPARSE_SUMMARY}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Progress value={achievementPercent} className="min-w-32 flex-1" barClassName="bg-brand" />
            <span className="shrink-0 text-sm font-medium text-primary">
              ได้ B ขึ้นไป {formatPercent(achievementPercent)}
            </span>
            {level === 'low' && <LowSampleTag counted={gradedPeople} />}
          </div>
        )}
        {isLoading && <Skeleton className="h-3 w-40" />}
        {isError && (
          <p className="text-xs text-destructive">ไม่สามารถโหลดจำนวนนิสิตที่ได้ B ขึ้นไปได้</p>
        )}
        {detail && (
          <p className="text-xs text-muted-foreground">
            ได้ B ขึ้นไป {detail.achievedStudents} จาก {detail.totalStudents} คน
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          คิดจากเกรดของวิชา (สัดส่วนคนที่ได้ B ขึ้นไป) ไม่ได้คิดจากคะแนนข้อสอบแต่ละชิ้น
        </p>
      </PageSection>

      <PageSection
        title="เป้าการเรียนรู้แต่ละข้อ"
        description="เป้าการเรียนรู้ (CLO) คือสิ่งที่นิสิตควรทำได้เมื่อเรียนจบวิชา ระบบยังไม่มีร้อยละรายข้อ จึงแสดงเฉพาะจำนวนคนที่มีคะแนนที่กรอกของแต่ละข้อ"
      >
        {sortedClos.map((clo) => (
          <div key={clo.cloId} className="rounded-md bg-slate-50 px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">{clo.code}</p>
                <p className="break-words text-sm text-primary">{clo.description}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {evidenceError ? (
                  <span className="text-xs text-destructive">โหลดคะแนนที่กรอกไม่สำเร็จ</span>
                ) : (
                  evidenceTotal !== undefined &&
                  evidenceCoverage !== undefined && (
                    <EvidenceCoverageBadge
                      coverage={{
                        validCount: evidenceCoverage.get(clo.cloId) ?? 0,
                        totalCount: evidenceTotal,
                      }}
                    />
                  )
                )}
              </div>
            </div>
          </div>
        ))}
      </PageSection>

      {(plos.length > 0 || scoredAssessmentClos.length > 0) && (
        <CollapsibleSection
          framed={false}
          title="เป้าหมายของหลักสูตรและคะแนนประเมินตนเอง"
          meta={
            <span className="text-sm font-normal text-muted-foreground">
              ข้อมูลประกอบ ไม่ต้องดูทุกครั้ง
            </span>
          }
        >
          {plos.length > 0 && (
            <PageSection
              title="เป้าหมายของหลักสูตรที่เกี่ยวข้อง"
              description="เป้าหมายของหลักสูตร (PLO) คือผลลัพธ์ที่หลักสูตรคาดหวังจากนิสิต"
            >
              {plos.map((plo) => (
                <div key={plo.ploId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {plo.code} · {plo.name}
                    </span>
                    <span className="font-medium text-primary">
                      {formatPercent(plo.achievementPercent)}
                    </span>
                  </div>
                  <Progress
                    value={plo.achievementPercent}
                    barClassName={ploProgressBarColorClassName(plo.achievementPercent, null)}
                  />
                </div>
              ))}
            </PageSection>
          )}

          {scoredAssessmentClos.length > 0 && (
            <PageSection title="คะแนนประเมินตนเองเฉลี่ยของแต่ละเป้า (เต็ม 5)">
              {scoredAssessmentClos.map((c) => (
                <div key={c.cloId} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {c.code}
                    {c.cloId === highestAssessmentCloId && (
                      <span className="ml-1.5 text-xs text-emerald-600">(สูงสุด)</span>
                    )}
                    {c.cloId === lowestAssessmentCloId && c.cloId !== highestAssessmentCloId && (
                      <span className="ml-1.5 text-xs text-amber-600">(ต่ำสุด)</span>
                    )}
                  </span>
                  <span className="font-medium text-primary">{c.averageScore!.toFixed(1)}</span>
                </div>
              ))}
            </PageSection>
          )}
        </CollapsibleSection>
      )}
    </div>
  );
}
