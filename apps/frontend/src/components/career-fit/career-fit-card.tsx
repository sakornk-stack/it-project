'use client';

import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, CircleCheck, CircleDashed, CircleDot, Compass } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CareerFitEntry, CareerFitLevel } from '@eduanalyze-ai/shared-types';
import { ApiErrorAlert } from '@/components/admin/api-error-alert';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchMyCareerFit } from '@/lib/api/career-fit';
import {
  buildCareerFitView,
  CAREER_FIT_DISCLAIMER,
  CAREER_FIT_INSUFFICIENT_TEXT,
  CAREER_FIT_LEVEL_TEXT,
  CAREER_FIT_LEVEL_TONE,
  CAREER_FIT_FEW_COURSES_TEXT,
  careerCoverageText,
  isFewCourseCareer,
} from '@/lib/career-fit';
import { describeApiError } from '@/lib/describe-api-error';
import { GRADE_LABELS } from '@/lib/grade-label';
import { BADGE_TONE_CLASSES, BAR_TONE_CLASSES } from '@/lib/tone';
import { cn } from '@/lib/utils';

// Word shown inside the featured ring (no score is ever displayed).
const RING_LEVEL_TEXT: Record<CareerFitLevel, string> = {
  HIGH: 'สูง',
  MEDIUM: 'ปานกลาง',
  LOW: 'ต่ำ',
};

// Short pill text for the secondary cards; the full sentence stays in aria-label.
export const LEVEL_SHORT: Record<CareerFitLevel, { text: string; icon: LucideIcon }> = {
  HIGH: { text: 'สอดคล้องมาก', icon: CircleCheck },
  MEDIUM: { text: 'สอดคล้องปานกลาง', icon: CircleDot },
  LOW: { text: 'สอดคล้องน้อย', icon: CircleDashed },
};

export function RankBadge({ rank, primary }: Readonly<{ rank: number; primary?: boolean }>) {
  return (
    <span
      aria-label={`อันดับที่ ${rank}`}
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums',
        primary ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
      )}
    >
      {rank}
    </span>
  );
}

function CourseChip({
  code,
  name,
  grade,
}: Readonly<{ code: string; name: string; grade?: string }>) {
  return (
    <li className="flex w-full items-center justify-between gap-3 rounded-md border bg-muted px-3 py-1.5 text-xs">
      <span className="min-w-0 truncate" title={`${code} ${name}`}>
        <span className="font-medium">{code}</span>{' '}
        <span className="text-muted-foreground">{name}</span>
      </span>
      {grade && (
        <span
          className={cn(
            'shrink-0 rounded-full border px-2 py-px font-medium',
            BADGE_TONE_CLASSES.neutral,
          )}
        >
          เกรด {grade}
        </span>
      )}
    </li>
  );
}

function ChipGroup({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <ul className="grid grid-cols-1 gap-2">{children}</ul>
    </div>
  );
}

function FeaturedCareer({ career }: Readonly<{ career: CareerFitEntry }>) {
  const level = career.level!;
  return (
    <li className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-3">
            <RankBadge rank={1} primary />
            <h3 className="min-w-0 break-words text-xl font-semibold leading-snug">
              {career.careerName}
            </h3>
          </div>
          <p className="text-sm font-medium">{CAREER_FIT_LEVEL_TEXT[level]}</p>
          <p className="text-xs text-muted-foreground">{careerCoverageText(career)}</p>
        </div>
        <ProgressRing
          value={career.score ?? 0}
          label={`${CAREER_FIT_LEVEL_TEXT[level]} (${career.careerName})`}
          tone={level === 'HIGH' ? 'default' : 'neutral'}
          size={72}
          strokeWidth={5}
          className="self-start sm:self-center"
        >
          <span className="text-xs font-semibold leading-tight">{RING_LEVEL_TEXT[level]}</span>
        </ProgressRing>
      </div>

      {career.topCourses.length > 0 && (
        <ChipGroup title="วิชาเด่นของคุณในสายนี้">
          {career.topCourses.map((c) => (
            <CourseChip key={c.code} code={c.code} name={c.name} grade={GRADE_LABELS[c.grade]} />
          ))}
        </ChipGroup>
      )}

      {career.recommendedCourses.length > 0 && (
        <ChipGroup title="วิชาที่ยังไม่ได้เรียนซึ่งช่วยเสริมสายนี้">
          {career.recommendedCourses.map((c) => (
            <CourseChip key={c.code} code={c.code} name={c.name} />
          ))}
        </ChipGroup>
      )}
    </li>
  );
}

function SecondaryCareer({ career, rank }: Readonly<{ career: CareerFitEntry; rank: number }>) {
  const level = career.level!;
  const tone = CAREER_FIT_LEVEL_TONE[level];
  const { text, icon: Icon } = LEVEL_SHORT[level];
  return (
    <li className="flex h-full min-w-0 flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <RankBadge rank={rank} />
        <h3 className="min-w-0 break-words text-base font-semibold leading-snug">
          {career.careerName}
        </h3>
      </div>
      <span
        role="img"
        aria-label={CAREER_FIT_LEVEL_TEXT[level]}
        className={cn(
          'inline-flex w-fit items-center gap-1 self-start rounded-full border px-2.5 py-0.5 text-xs font-medium',
          BADGE_TONE_CLASSES[tone],
        )}
      >
        <Icon size={12} aria-hidden="true" />
        {text}
      </span>
      <div className="space-y-1">
        <Progress
          value={career.score ?? 0}
          label={CAREER_FIT_LEVEL_TEXT[level]}
          className="h-1.5"
          barClassName={BAR_TONE_CLASSES[tone]}
        />
        <p className="text-xs text-muted-foreground">{careerCoverageText(career)}</p>
      </div>
      {career.topCourses.length > 0 && (
        <ChipGroup title="วิชาเด่นของคุณ">
          {career.topCourses.map((c) => (
            <CourseChip key={c.code} code={c.code} name={c.name} grade={GRADE_LABELS[c.grade]} />
          ))}
        </ChipGroup>
      )}
      {career.recommendedCourses.length > 0 && (
        <ChipGroup title="วิชาที่ยังไม่ได้เรียนซึ่งช่วยเสริม">
          {career.recommendedCourses.slice(0, 2).map((c) => (
            <CourseChip key={c.code} code={c.code} name={c.name} />
          ))}
        </ChipGroup>
      )}
    </li>
  );
}

function OtherCareerRow({ career, rank }: Readonly<{ career: CareerFitEntry; rank: number }>) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const level = career.level!;
  const { text, icon: Icon } = LEVEL_SHORT[level];
  return (
    <li className="rounded-lg border bg-card">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center gap-3 rounded-lg p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <RankBadge rank={rank} />
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="min-w-0 break-words text-sm font-medium leading-snug">
            {career.careerName}
          </span>
          <span
            role="img"
            aria-label={CAREER_FIT_LEVEL_TEXT[level]}
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
              BADGE_TONE_CLASSES[CAREER_FIT_LEVEL_TONE[level]],
            )}
          >
            <Icon size={12} aria-hidden="true" />
            {text}
          </span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={cn(
            'shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        />
      </button>
      <div id={panelId} hidden={!open} className="space-y-3 px-3 pb-3">
        {career.topCourses.length > 0 && (
          <ChipGroup title="วิชาเด่นของคุณ">
            {career.topCourses.map((c) => (
              <CourseChip key={c.code} code={c.code} name={c.name} grade={GRADE_LABELS[c.grade]} />
            ))}
          </ChipGroup>
        )}
        {career.recommendedCourses.length > 0 && (
          <ChipGroup title="วิชาที่ยังไม่ได้เรียนซึ่งช่วยเสริม">
            {career.recommendedCourses.map((c) => (
              <CourseChip key={c.code} code={c.code} name={c.name} />
            ))}
          </ChipGroup>
        )}
        <p className="text-xs text-muted-foreground">{careerCoverageText(career)}</p>
      </div>
    </li>
  );
}

function CareerFitSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="space-y-3 rounded-xl border p-5">
        <Skeleton className="h-6 w-3/5" />
        <Skeleton className="h-4 w-2/5" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-7 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}

export function CareerFitCard() {
  const query = useQuery({ queryKey: ['career-fit-me'], queryFn: fetchMyCareerFit });

  let body;
  if (query.isLoading) {
    body = <CareerFitSkeleton />;
  } else if (query.isError || !query.data) {
    body = (
      <ApiErrorAlert
        message={describeApiError(
          query.error,
          {},
          'ไม่สามารถโหลดแนวทางอาชีพได้ กรุณาลองใหม่อีกครั้ง',
        )}
        onRetry={() => query.refetch()}
      />
    );
  } else {
    const view = buildCareerFitView(query.data);
    if (view.kind === 'empty') {
      body = <EmptyState icon={Compass} description={view.emptyText} />;
    } else {
      body = (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            วิเคราะห์ได้ {view.analyzedCount} จาก {view.totalCount} สาย
          </p>
          {view.ranked.length > 0 ? (
            <ol className="space-y-3">
              <FeaturedCareer career={view.ranked[0]} />
              {view.ranked.length > 1 && (
                <li className="list-none">
                  <ol className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-2">
                    {view.ranked.slice(1).map((c, i) => (
                      <SecondaryCareer key={c.careerId} career={c} rank={i + 2} />
                    ))}
                  </ol>
                </li>
              )}
            </ol>
          ) : (
            <EmptyState
              icon={Compass}
              description="ยังมีผลการเรียนในแต่ละสายไม่เพียงพอสำหรับการประเมิน"
            />
          )}
          {view.others.length > 0 && (
            <CollapsibleSection
              title={`สายอื่นที่วิเคราะห์ได้ (${view.others.length} สาย)`}
              framed={false}
            >
              <ul className="space-y-2">
                {view.others.map((c, i) => (
                  <OtherCareerRow key={c.careerId} career={c} rank={view.ranked.length + i + 1} />
                ))}
              </ul>
            </CollapsibleSection>
          )}
          {view.insufficient.length > 0 && (
            <CollapsibleSection
              title={`สายที่ข้อมูลยังไม่เพียงพอ (${view.insufficient.length} สาย)`}
              framed={false}
            >
              {view.insufficient.some((c) => !isFewCourseCareer(c)) && (
                <p className="text-sm text-muted-foreground">{CAREER_FIT_INSUFFICIENT_TEXT}</p>
              )}
              <ul className="space-y-2">
                {view.insufficient.map((c) => (
                  <li key={c.careerId} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">{c.careerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {isFewCourseCareer(c) ? CAREER_FIT_FEW_COURSES_TEXT : careerCoverageText(c)}
                    </p>
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          )}
        </div>
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Compass size={16} className="text-brand" aria-hidden="true" />
          แนวทางอาชีพ
        </CardTitle>
      </CardHeader>
      <CardContent className="mx-auto w-full max-w-3xl space-y-4">
        {body}
        <p className="text-xs text-muted-foreground">{CAREER_FIT_DISCLAIMER}</p>
      </CardContent>
    </Card>
  );
}
