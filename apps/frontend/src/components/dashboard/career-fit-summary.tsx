'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Compass } from 'lucide-react';
import type { CareerFitEntry } from '@eduanalyze-ai/shared-types';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { CareerGroupLabel, LEVEL_SHORT, RankBadge } from '@/components/career-fit/career-fit-card';
import { Reveal } from '@/components/layout/reveal';
import { PageSection } from '@/components/layout/page-section';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchMyCareerFit } from '@/lib/api/career-fit';
import { buildCareerFitView, CAREER_FIT_LEVEL_TEXT, CAREER_FIT_LEVEL_TONE } from '@/lib/career-fit';
import { describeApiError } from '@/lib/describe-api-error';
import { formatFiveScale } from '@/lib/five-scale';
import { BADGE_TONE_CLASSES, BAR_TONE_CLASSES } from '@/lib/tone';
import { cn } from '@/lib/utils';

const GRID_CLASS = 'grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3';

function CareerTile({ career, rank }: Readonly<{ career: CareerFitEntry; rank: number }>) {
  const level = career.level!;
  const tone = CAREER_FIT_LEVEL_TONE[level];
  const { text, icon: Icon } = LEVEL_SHORT[level];
  return (
    <li className="h-full">
      <Reveal index={rank} className="h-full">
        <Link
          href="/aptitude-analysis"
          aria-label={`${career.careerName}: ${CAREER_FIT_LEVEL_TEXT[level]} ดูรายละเอียดที่หน้าสรุปความถนัด`}
          className="group flex h-full min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md focus-visible:-translate-y-0.5 focus-visible:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-y-0"
        >
          <div className="flex items-start gap-3">
            <RankBadge rank={rank} primary={rank === 1} />
            <h3 className="min-w-0 flex-1 break-words text-base font-semibold leading-snug text-primary">
              {career.careerName}
            </h3>
            <ArrowRight
              size={16}
              aria-hidden="true"
              className="mt-1 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-[transform,opacity] duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none"
            />
          </div>
          {career.group && <CareerGroupLabel name={career.group.name} />}
          <span
            className={cn(
              'inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
              BADGE_TONE_CLASSES[tone],
            )}
          >
            <Icon size={12} aria-hidden="true" />
            {text}
          </span>
          <div className="mt-auto space-y-1.5">
            <p className="text-sm tabular-nums text-primary">
              <span className="text-xl font-semibold">
                <AnimatedNumber
                  value={career.score}
                  decimals={1}
                  duration={700}
                  format={(n) => formatFiveScale(n)}
                />
              </span>
              <span className="text-muted-foreground"> / 5.0</span>
            </p>
            <Progress
              value={career.score ?? 0}
              label={`${career.careerName}: ${CAREER_FIT_LEVEL_TEXT[level]}`}
              className="h-1.5"
              animateOnView
              barClassName={BAR_TONE_CLASSES[tone]}
            />
          </div>
        </Link>
      </Reveal>
    </li>
  );
}

export function CareerFitSummarySkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-56" />
      <div className={GRID_CLASS} aria-hidden="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-1.5 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Top three careers only; the full list lives on /aptitude-analysis. The query
// key matches CareerFitCard there so both pages share one cache entry. Its error
// and empty states stay inside this section and never affect the rest of the page.
export function CareerFitSummary() {
  const query = useQuery({ queryKey: ['career-fit-me'], queryFn: fetchMyCareerFit });

  if (query.isLoading) return <CareerFitSummarySkeleton />;

  const view = query.data ? buildCareerFitView(query.data) : null;
  let body;
  if (query.isError || !view) {
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
  } else if (view.ranked.length === 0) {
    body = (
      <EmptyState
        icon={Compass}
        description={view.emptyText ?? 'ยังมีผลการเรียนในแต่ละสายไม่เพียงพอสำหรับการประเมิน'}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/aptitude-analysis">ดูรายละเอียดที่หน้าสรุปความถนัด</Link>
          </Button>
        }
      />
    );
  } else {
    body = (
      <div className="space-y-3">
        <ol className={GRID_CLASS}>
          {view.ranked.map((career, i) => (
            <CareerTile key={career.careerId} career={career} rank={i + 1} />
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">
          ประเมินจากผลการเรียนในรายวิชาที่เกี่ยวข้อง ใช้เป็นแนวทางเท่านั้น
        </p>
      </div>
    );
  }

  return (
    <PageSection
      title="แนวทางอาชีพที่เหมาะกับนิสิต"
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href="/aptitude-analysis">ดูทุกสายอาชีพ</Link>
        </Button>
      }
    >
      {body}
    </PageSection>
  );
}
