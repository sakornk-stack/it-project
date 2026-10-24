'use client';

import { useQuery } from '@tanstack/react-query';
import { CircleCheck, CircleDot, Compass, RefreshCw, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AiCareerFitLevel, AiCareerSuggestion } from '@eduanalyze-ai/shared-types';
import { fetchAiCareerSuggestions } from '@/lib/api/ai-analysis';
import { describeApiError } from '@/lib/describe-api-error';
import { BADGE_TONE_CLASSES, type SemanticTone } from '@/lib/tone';
import { cn } from '@/lib/utils';
import { AiDisclosureNotice } from '@/components/ai/ai-disclosure-notice';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

// Words, never a score: the model returns no numbers, and the level says how
// much of the transcript backs the career, not whether the student can do it.
const FIT_VIEW: Record<AiCareerFitLevel, { text: string; tone: SemanticTone; icon: LucideIcon }> = {
  STRONG: { text: 'ผลการเรียนสนับสนุนมาก', tone: 'success', icon: CircleCheck },
  GOOD: { text: 'ผลการเรียนสนับสนุนบางส่วน', tone: 'neutral', icon: CircleDot },
  WORTH_EXPLORING: { text: 'น่าลองพิจารณา', tone: 'neutral', icon: Compass },
};

export const AI_CAREER_DISCLAIMER =
  'คำแนะนำนี้สร้างโดย AI จากรายวิชาที่ผ่านและผล PLO ของคุณ ไม่ใช่การประเมินความสามารถจริงหรือการรับรองว่าจะทำอาชีพนั้นได้ ใช้เป็นจุดเริ่มต้นในการคุยกับอาจารย์ที่ปรึกษา';

const UNAVAILABLE = 'ยังวิเคราะห์ไม่ได้ในตอนนี้ กรุณาลองใหม่อีกครั้ง';

// Runs only when the student presses the button (the call sends their data to
// Anthropic and costs money). The answer is kept for the rest of the session,
// so leaving the page and coming back does not ask again until "วิเคราะห์ใหม่".
export function AiCareerSuggestions({ studentProfileId }: Readonly<{ studentProfileId: string }>) {
  const query = useQuery({
    queryKey: ['ai-career-suggestions', studentProfileId],
    queryFn: () => fetchAiCareerSuggestions(studentProfileId),
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  const running = query.isFetching;
  const report = query.data;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Sparkles size={16} className="text-brand" aria-hidden="true" />
          AI แนะนำสายอาชีพ
        </CardTitle>
        {report && !running && (
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            onClick={() => query.refetch()}
          >
            <RefreshCw size={14} aria-hidden="true" />
            วิเคราะห์ใหม่
          </Button>
        )}
      </CardHeader>
      <CardContent className="mx-auto w-full max-w-5xl space-y-4">
        {!report && !running && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              ให้ AI ดูรายวิชาที่คุณผ่านและผล PLO แล้วเสนอสายอาชีพที่ผลการเรียนสนับสนุน
              พร้อมเหตุผลและสิ่งที่ควรฝึกเพิ่ม
            </p>
            <AiDisclosureNotice />
            <Button type="button" className="gap-1.5" onClick={() => query.refetch()}>
              <Sparkles size={16} aria-hidden="true" />
              ให้ AI แนะนำอาชีพ
            </Button>
          </div>
        )}

        {running && (
          <div role="status" aria-live="polite" className="space-y-3">
            <p className="text-sm text-muted-foreground">
              AI กำลังวิเคราะห์ผลการเรียนของคุณ อาจใช้เวลาประมาณครึ่งนาที…
            </p>
            <Skeleton className="h-4 w-3/4" />
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          </div>
        )}

        {query.isError && !running && (
          <ApiErrorAlert
            message={describeApiError(query.error, {}, UNAVAILABLE)}
            onRetry={() => query.refetch()}
          />
        )}

        {report && !running && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed">{report.overview}</p>
            {report.careers.length === 0 ? (
              <EmptyState icon={Compass} description="ยังไม่มีผลการเรียนพอสำหรับเสนอสายอาชีพ" />
            ) : (
              <ol className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {report.careers.map((career, i) => (
                  <CareerItem key={`${career.title}-${i}`} career={career} rank={i + 1} />
                ))}
              </ol>
            )}
            <p className="text-xs text-muted-foreground">
              วิเคราะห์เมื่อ{' '}
              {new Date(report.generatedAt).toLocaleString('th-TH', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">{AI_CAREER_DISCLAIMER}</p>
      </CardContent>
    </Card>
  );
}

function CareerItem({ career, rank }: Readonly<{ career: AiCareerSuggestion; rank: number }>) {
  const fit = FIT_VIEW[career.fit];
  const FitIcon = fit.icon;
  return (
    <li className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <span
          aria-label={`อันดับที่ ${rank}`}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums',
            rank === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
          )}
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="break-words font-semibold text-primary">{career.title}</p>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
              BADGE_TONE_CLASSES[fit.tone],
            )}
          >
            <FitIcon size={12} aria-hidden="true" />
            {fit.text}
          </span>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{career.reason}</p>
      {career.supportingCourses.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium">วิชาที่สนับสนุน</p>
          <ul className="flex flex-wrap gap-1.5">
            {career.supportingCourses.map((course) => (
              <li
                key={course.code}
                title={course.name}
                className="max-w-full truncate rounded-md border bg-muted/50 px-2 py-0.5 text-xs"
              >
                <span className="font-mono">{course.code}</span> {course.name}
              </li>
            ))}
          </ul>
        </div>
      )}
      {career.skillsToBuild.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium">ควรฝึกเพิ่ม</p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
            {career.skillsToBuild.map((skill) => (
              <li key={skill}>{skill}</li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}
