'use client';

import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, CircleCheck, CircleDashed, CircleDot, Compass, Layers } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CareerFitEntry, CareerFitLevel } from '@eduanalyze-ai/shared-types';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchMyCareerFit } from '@/lib/api/career-fit';
import {
  buildCareerFitView,
  CAREER_GROUP_INSUFFICIENT_TEXT,
  CAREER_FIT_DISCLAIMER,
  CAREER_FIT_INSUFFICIENT_TEXT,
  CAREER_FIT_LEVEL_TEXT,
  CAREER_FIT_LEVEL_TICKS,
  CAREER_FIT_LEVEL_TONE,
  CAREER_FIT_FEW_COURSES_TEXT,
  careerCoverageText,
  careerRankText,
  isFewCourseCareer,
  topCareerSummary,
  type CareerFitGroupView,
  type CareerFitView,
} from '@/lib/career-fit';
import { describeApiError } from '@/lib/describe-api-error';
import { GRADE_LABELS } from '@/lib/grade-label';
import { BADGE_TONE_CLASSES, BAR_TONE_CLASSES } from '@/lib/tone';
import { cn } from '@/lib/utils';

// Short level text; the full sentence stays in aria-label.
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
  wrap,
}: Readonly<{ code: string; name: string; grade?: string; wrap?: boolean }>) {
  return (
    <li className="flex w-full items-center justify-between gap-3 rounded-md border bg-muted px-3 py-1.5 text-xs">
      <span
        className={cn('min-w-0', wrap ? 'break-words' : 'truncate')}
        title={wrap ? undefined : `${code} ${name}`}
      >
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

// Optional text; renders nothing when the career has no description yet.
function CareerDescription({ career }: Readonly<{ career: CareerFitEntry }>) {
  const text = career.description?.trim();
  if (!text) return null;
  return <p className="break-words text-sm text-muted-foreground">{text}</p>;
}

function LevelPill({ level }: Readonly<{ level: CareerFitLevel }>) {
  const { text, icon: Icon } = LEVEL_SHORT[level];
  return (
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
  );
}

// Decorative 3-tick bar that repeats the level label next to it (never the only carrier).
function LevelTicks({ level }: Readonly<{ level: CareerFitLevel }>) {
  const filled = CAREER_FIT_LEVEL_TICKS[level];
  const barClass = BAR_TONE_CLASSES[CAREER_FIT_LEVEL_TONE[level]];
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 items-center gap-1">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={cn(
            'h-2 w-6 rounded-full border',
            n <= filled ? cn(barClass, 'border-transparent') : 'border-border bg-transparent',
          )}
        />
      ))}
    </span>
  );
}

// Shared with the dashboard tiles so the group label reads the same on both pages.
export function CareerGroupLabel({ name }: Readonly<{ name: string }>) {
  return (
    <p className="flex items-start gap-1 break-words text-xs text-muted-foreground">
      <Layers size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>กลุ่ม: {name}</span>
    </p>
  );
}

// Always-open card for one of the top careers: everything needed to judge it is visible.
function RecommendedCareer({ career, rank }: Readonly<{ career: CareerFitEntry; rank: number }>) {
  const level = career.level!;
  return (
    <li className="flex h-full min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <RankBadge rank={rank} primary={rank === 1} />
        <div className="min-w-0 space-y-1">
          <h5 className="break-words text-base font-semibold leading-snug">{career.careerName}</h5>
          {career.group && <CareerGroupLabel name={career.group.name} />}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <LevelPill level={level} />
        <LevelTicks level={level} />
      </div>
      <CareerDescription career={career} />
      {career.topCourses.length > 0 && (
        <ChipGroup title="วิชาเด่นของนิสิตในสายนี้">
          {career.topCourses.map((c) => (
            <CourseChip
              key={c.code}
              code={c.code}
              name={c.name}
              grade={GRADE_LABELS[c.grade]}
              wrap
            />
          ))}
        </ChipGroup>
      )}
      <p className="mt-auto text-xs text-muted-foreground">{careerCoverageText(career)}</p>
    </li>
  );
}

// One analysable career in the full list: a real button toggles the details. The level is
// shown as ticks plus plain text (not a second pill) and the rank says "#N of M".
function CareerRow({
  career,
  rank,
  total,
}: Readonly<{ career: CareerFitEntry; rank: number; total: number }>) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const level = career.level!;
  return (
    <li className="rounded-lg border bg-card">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center gap-3 rounded-lg p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="min-w-0 break-words text-sm font-medium leading-snug">
            {career.careerName}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <LevelTicks level={level} />
            <span>{LEVEL_SHORT[level].text}</span>
            <span aria-hidden="true">·</span>
            <span>{careerRankText(rank, total)}</span>
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
      <div className="px-3 pb-3">
        <CareerDescription career={career} />
      </div>
      <div id={panelId} hidden={!open} className="space-y-3 px-3 pb-3">
        <p className="text-sm font-medium">{CAREER_FIT_LEVEL_TEXT[level]}</p>
        {career.topCourses.length > 0 && (
          <ChipGroup title="วิชาเด่นของนิสิต">
            {career.topCourses.map((c) => (
              <CourseChip
                key={c.code}
                code={c.code}
                name={c.name}
                grade={GRADE_LABELS[c.grade]}
                wrap
              />
            ))}
          </ChipGroup>
        )}
        {career.recommendedCourses.length > 0 && (
          <ChipGroup title="วิชาที่ยังไม่ได้เรียนซึ่งช่วยเสริม">
            {career.recommendedCourses.map((c) => (
              <CourseChip key={c.code} code={c.code} name={c.name} wrap />
            ))}
          </ChipGroup>
        )}
        <p className="text-xs text-muted-foreground">{careerCoverageText(career)}</p>
      </div>
    </li>
  );
}

// Careers of one group (or the whole flat list) in rank order; the ones that cannot be
// analysed yet follow, each with the reason.
function CareerList({
  careers,
  rankById,
  total,
}: Readonly<{ careers: CareerFitEntry[]; rankById: Map<string, number>; total: number }>) {
  return (
    <ul className="space-y-2">
      {careers.map((c) =>
        c.level !== null && c.status === 'OK' ? (
          <CareerRow
            key={c.careerId}
            career={c}
            rank={rankById.get(c.careerId) ?? 0}
            total={total}
          />
        ) : (
          <li key={c.careerId} className="space-y-1 rounded-lg border bg-card p-3 text-sm">
            <p className="font-medium">{c.careerName}</p>
            <CareerDescription career={c} />
            <p className="text-xs text-muted-foreground">
              {isFewCourseCareer(c) ? CAREER_FIT_FEW_COURSES_TEXT : careerCoverageText(c)}
            </p>
          </li>
        ),
      )}
    </ul>
  );
}

function GroupLevelPill({ group }: Readonly<{ group: CareerFitGroupView }>) {
  if (!group.level) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
          BADGE_TONE_CLASSES.neutral,
        )}
      >
        <CircleDashed size={12} aria-hidden="true" />
        {CAREER_GROUP_INSUFFICIENT_TEXT}
      </span>
    );
  }
  const { text, icon: Icon } = LEVEL_SHORT[group.level];
  return (
    <span
      role="img"
      aria-label={`${text} (ประเมินจากสายที่เด่นที่สุดในกลุ่ม)`}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        BADGE_TONE_CLASSES[CAREER_FIT_LEVEL_TONE[group.level]],
      )}
    >
      <Icon size={12} aria-hidden="true" />
      {text}
    </span>
  );
}

// One collapsible card per career group, best group first (the first one opens by default).
// The group's level is its best career's level; per-career scores and ranking are untouched.
function CareerGroupsList({
  view,
  rankById,
}: Readonly<{ view: CareerFitView; rankById: Map<string, number> }>) {
  return (
    <ul className="space-y-3">
      {view.groups.map((group, i) => (
        <li key={group.key}>
          <CollapsibleSection
            framed={false}
            defaultOpen={i === 0 && group.analyzedCount > 0}
            title={group.name}
            meta={
              <>
                <GroupLevelPill group={group} />
                <span className="text-xs font-normal text-muted-foreground">
                  {group.careers.length} สาย
                </span>
              </>
            }
          >
            {group.description && (
              <p className="break-words text-sm text-muted-foreground">{group.description}</p>
            )}
            <CareerList careers={group.careers} rankById={rankById} total={view.analyzedCount} />
          </CollapsibleSection>
        </li>
      ))}
    </ul>
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
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}

export function CareerFitCard() {
  const query = useQuery({ queryKey: ['career-fit-me'], queryFn: fetchMyCareerFit });
  const headingId = useId();

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
      const rankById = new Map([...view.ranked, ...view.others].map((c, i) => [c.careerId, i + 1]));
      const summary = topCareerSummary(view.ranked[0]);
      body = (
        <div className="space-y-6">
          <div className="space-y-1">
            {summary && (
              <p className="break-words text-sm">
                สายที่เหมาะกับนิสิตที่สุด:{' '}
                <span className="font-semibold text-primary">{summary.careerName}</span>
                {summary.groupName && <> (กลุ่ม {summary.groupName})</>}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              วิเคราะห์ได้ {view.analyzedCount} จาก {view.totalCount} สาย
            </p>
          </div>

          <section aria-labelledby={`${headingId}-top`} className="space-y-3">
            <h4 id={`${headingId}-top`} className="text-base font-semibold">
              แนะนำสำหรับนิสิต
            </h4>
            {view.ranked.length > 0 ? (
              <ol className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-3">
                {view.ranked.map((c, i) => (
                  <RecommendedCareer key={c.careerId} career={c} rank={i + 1} />
                ))}
              </ol>
            ) : (
              <EmptyState
                icon={Compass}
                description="ยังมีผลการเรียนในแต่ละสายไม่เพียงพอสำหรับการประเมิน"
              />
            )}
          </section>

          <section aria-labelledby={`${headingId}-all`} className="space-y-3">
            <h4 id={`${headingId}-all`} className="text-base font-semibold">
              {view.hasGroups ? 'ดูทั้งหมดตามกลุ่ม' : 'ดูทั้งหมด'}
            </h4>
            {view.hasGroups ? (
              <CareerGroupsList view={view} rankById={rankById} />
            ) : (
              <CareerList
                careers={[...view.ranked, ...view.others, ...view.insufficient]}
                rankById={rankById}
                total={view.analyzedCount}
              />
            )}
          </section>
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
      <CardContent className="mx-auto w-full max-w-5xl space-y-4">
        {body}
        <p className="text-xs text-muted-foreground">{CAREER_FIT_DISCLAIMER}</p>
      </CardContent>
    </Card>
  );
}
