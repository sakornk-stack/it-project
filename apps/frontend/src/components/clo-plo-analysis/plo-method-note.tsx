import { ChevronDown, Info } from 'lucide-react';
import type { StudentPloRadarPoint } from '@eduanalyze-ai/shared-types';
import {
  INSTRUCTOR_ASSESSED_COURSE_CODES,
  INSTRUCTOR_ASSESSED_NOTE,
  PLO_METHOD_LINES,
  PLO_THRESHOLD_LINE,
  TQF_CURRICULUM_NOTE,
  ploCoverage,
} from '@/lib/plo-notes';
import { INFO_TONE_CLASSES } from '@/lib/tone';
import { cn } from '@/lib/utils';

// Plain-language "where does this number come from" under a student's PLO chart.
export function PloMethodNote({
  radar,
  showThreshold = false,
  showCoverage = false,
  tqf = false,
}: Readonly<{
  radar: StudentPloRadarPoint[];
  showThreshold?: boolean;
  showCoverage?: boolean;
  // TQF curricula (2559, 2564): outcomes are the five TQF domains, not OBE PLOs.
  tqf?: boolean;
}>) {
  const instructorCourses = new Map<string, string>();
  for (const plo of radar) {
    for (const clo of plo.cloBreakdown) {
      if (INSTRUCTOR_ASSESSED_COURSE_CODES.has(clo.courseCode)) {
        instructorCourses.set(clo.courseCode, clo.courseName);
      }
    }
  }

  return (
    <div className="space-y-3">
      {tqf && (
        <p
          className={cn(
            'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
            INFO_TONE_CLASSES.badge,
          )}
        >
          <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{TQF_CURRICULUM_NOTE}</span>
        </p>
      )}
      <details className="group rounded-lg bg-muted/50 text-xs leading-5 text-muted-foreground">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-2 font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-1.5">
            <Info size={14} aria-hidden="true" className="shrink-0" />
            ตัวเลขนี้มาจากไหน
          </span>
          <ChevronDown
            size={14}
            aria-hidden="true"
            className="shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <div className="space-y-2 px-3 pb-3">
          <ul className="list-disc space-y-1 pl-5">
            {PLO_METHOD_LINES.map((line) => (
              <li key={line}>{line}</li>
            ))}
            {showThreshold && <li>{PLO_THRESHOLD_LINE}</li>}
            {[...instructorCourses].map(([code, name]) => (
              <li key={code}>
                วิชา {code} {name}: {INSTRUCTOR_ASSESSED_NOTE}
              </li>
            ))}
          </ul>
          {showCoverage && radar.length > 0 && (
            <ul className="grid grid-cols-1 gap-x-4 gap-y-0.5 border-t border-border pt-2 sm:grid-cols-2">
              {radar.map((plo) => {
                const { used, total } = ploCoverage(plo);
                return (
                  <li key={plo.ploId}>
                    <span className="font-medium text-primary">{plo.code}</span> คำนวณจาก {used} จาก{' '}
                    {total} วิชา
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </details>
    </div>
  );
}
