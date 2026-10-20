'use client';

import { useMemo, type ReactNode } from 'react';
import { Layers, ListChecks, Target } from 'lucide-react';
import type {
  CloAchievementEntry,
  CoursePloEntry,
  CourseCloAchievementReport,
} from '@eduanalyze-ai/shared-types';
import { SPARSE_SUMMARY, dataLevelOf } from '@/lib/course-snapshot';
import { ploProgressBarColorClassName } from '@/lib/plo-color';
import { TEXT_TONE_CLASSES } from '@/lib/tone';
import { cn } from '@/lib/utils';
import {
  NO_CLO_DATA_HINT,
  NO_CLO_DATA_LABEL,
  cloBarValue,
  formatCloPercent,
  hasCloPercent,
} from '@/lib/clo-percent';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { GradeEstimateBadge } from '@/components/ui/grade-estimate-badge';
import { LowSampleTag } from './overview-parts';
import { CollapsibleCard, SectionCard } from '@/components/ui/section-card';

// A small titled block inside a card; the card's own title is the only h2.
function SubBlock({
  title,
  description,
  aside,
  children,
}: Readonly<{ title: string; description?: string; aside?: ReactNode; children: ReactNode }>) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-primary">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}

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
  onRetry,
}: Readonly<{
  // People counted in the B-or-above share (W and I left out): how much the
  // share can be trusted.
  gradedPeople: number;
  // null = no student with a final grade yet.
  achievementPercent: number | null;
  clos: CloAchievementEntry[];
  plos: CoursePloEntry[];
  courseAssessment: CourseAssessmentSummary;
  detail: CourseCloAchievementReport | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}>) {
  const level = dataLevelOf(gradedPeople);
  const sortedClos = useMemo(
    () => [...clos].sort((a, b) => a.code.localeCompare(b.code, 'th', { numeric: true })),
    [clos],
  );

  const scoredAssessmentClos = useMemo(
    () =>
      courseAssessment.clos.flatMap((c) =>
        c.averageScore !== null && c.scoreCount > 0 ? [{ ...c, averageScore: c.averageScore }] : [],
      ),
    [courseAssessment.clos],
  );
  const lowestAssessmentCloId = useMemo(
    () =>
      scoredAssessmentClos.length === 0
        ? null
        : scoredAssessmentClos.reduce(
            (min, c) => (c.averageScore < min.averageScore ? c : min),
            scoredAssessmentClos[0],
          ).cloId,
    [scoredAssessmentClos],
  );
  const highestAssessmentCloId = useMemo(
    () =>
      scoredAssessmentClos.length === 0
        ? null
        : scoredAssessmentClos.reduce(
            (max, c) => (c.averageScore > max.averageScore ? c : max),
            scoredAssessmentClos[0],
          ).cloId,
    [scoredAssessmentClos],
  );

  return (
    <div className="space-y-6">
      <SectionCard
        icon={Target}
        title="ภาพรวมเป้าการเรียนรู้"
        description="สัดส่วนนิสิตที่ได้ B ขึ้นไปของวิชานี้"
        aside={<GradeEstimateBadge />}
      >
        {!hasCloPercent(achievementPercent) ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{NO_CLO_DATA_LABEL}</p>
            <p className="text-xs text-muted-foreground">{NO_CLO_DATA_HINT}</p>
          </div>
        ) : level === 'insufficient' ? (
          <p className="text-sm text-muted-foreground">{SPARSE_SUMMARY}</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-4xl font-bold leading-none tabular-nums text-primary">
                {formatCloPercent(achievementPercent)}
              </span>
              <span className="text-sm text-muted-foreground">ได้ B ขึ้นไป</span>
              {level === 'low' && <LowSampleTag counted={gradedPeople} />}
            </div>
            <Progress
              value={achievementPercent}
              label={`ได้ B ขึ้นไป ${formatCloPercent(achievementPercent)}`}
              className="w-full"
              barClassName="bg-brand"
            />
          </div>
        )}
        {isLoading && <Skeleton className="h-3 w-40" />}
        {isError && (
          <ApiErrorAlert
            message="ไม่สามารถโหลดจำนวนนิสิตที่ได้ B ขึ้นไปได้ กรุณาลองใหม่อีกครั้ง"
            onRetry={onRetry}
          />
        )}
        {detail && (
          <p className="text-xs text-muted-foreground">
            ได้ B ขึ้นไป {detail.achievedStudents} จาก {detail.totalStudents} คน
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          ค่าในหน้านี้คำนวณจากเกรดของวิชา (สัดส่วนคนที่ได้ B ขึ้นไป)
          ไม่ได้คิดจากคะแนนข้อสอบแต่ละชิ้น
        </p>
      </SectionCard>

      <SectionCard
        icon={ListChecks}
        title="เป้าการเรียนรู้แต่ละข้อ"
        description="เป้าการเรียนรู้ (CLO) คือสิ่งที่นิสิตควรทำได้เมื่อเรียนจบวิชา"
      >
        <ul className="-my-3 divide-y divide-slate-100">
          {sortedClos.map((clo) => (
            <li key={clo.cloId} className="flex min-h-16 items-center gap-3 py-3">
              <Badge tone="neutral" className="w-14 justify-center font-mono">
                {clo.code}
              </Badge>
              <p
                className="line-clamp-2 min-w-0 flex-1 break-words text-sm text-primary"
                title={clo.description}
              >
                {clo.description}
              </p>
            </li>
          ))}
        </ul>
      </SectionCard>

      {(plos.length > 0 || scoredAssessmentClos.length > 0) && (
        <CollapsibleCard
          icon={Layers}
          title="เป้าหมายของหลักสูตรและคะแนนประเมินตนเอง"
          description="ข้อมูลประกอบ ไม่ต้องดูทุกครั้ง"
        >
          {plos.length > 0 && (
            <SubBlock
              title="เป้าหมายของหลักสูตรที่เกี่ยวข้อง"
              description="เป้าหมายของหลักสูตร (PLO) คือผลลัพธ์ที่หลักสูตรคาดหวังจากนิสิต"
              aside={<GradeEstimateBadge />}
            >
              {plos.map((plo) => (
                <div key={plo.ploId} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span className="min-w-0 break-words">
                      {plo.code} · {plo.name}
                    </span>
                    <span className="shrink-0 font-medium text-primary">
                      {formatCloPercent(plo.achievementPercent)}
                    </span>
                  </div>
                  {hasCloPercent(plo.achievementPercent) ? (
                    <Progress
                      value={cloBarValue(plo.achievementPercent)}
                      barClassName={ploProgressBarColorClassName(plo.achievementPercent, null)}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">{NO_CLO_DATA_HINT}</p>
                  )}
                </div>
              ))}
            </SubBlock>
          )}

          {scoredAssessmentClos.length > 0 && (
            <SubBlock title="คะแนนประเมินตนเองเฉลี่ยของแต่ละเป้า (เต็ม 5)">
              {scoredAssessmentClos.map((c) => (
                <div key={c.cloId} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {c.code}
                    {c.cloId === highestAssessmentCloId && (
                      <span className={cn('ml-1.5 text-xs', TEXT_TONE_CLASSES.success)}>
                        (สูงสุด)
                      </span>
                    )}
                    {c.cloId === lowestAssessmentCloId && c.cloId !== highestAssessmentCloId && (
                      <span className={cn('ml-1.5 text-xs', TEXT_TONE_CLASSES.warning)}>
                        (ต่ำสุด)
                      </span>
                    )}
                  </span>
                  <span className="font-medium tabular-nums text-primary">
                    {c.averageScore.toFixed(1)}
                  </span>
                </div>
              ))}
            </SubBlock>
          )}
        </CollapsibleCard>
      )}
    </div>
  );
}
