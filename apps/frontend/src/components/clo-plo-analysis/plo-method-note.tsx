import { Info } from 'lucide-react';
import type { StudentPloRadarPoint } from '@eduanalyze-ai/shared-types';
import {
  INSTRUCTOR_ASSESSED_COURSE_CODES,
  INSTRUCTOR_ASSESSED_NOTE,
  PLO_METHOD_LINES,
  PLO_THRESHOLD_LINE,
  PRELIMINARY_CLO_NOTE,
  ploCoverage,
} from '@/lib/plo-notes';

// Plain-language "where does this number come from" under a student's PLO chart.
export function PloMethodNote({
  radar,
  showThreshold = false,
  showCoverage = false,
  preliminary = false,
}: Readonly<{
  radar: StudentPloRadarPoint[];
  showThreshold?: boolean;
  showCoverage?: boolean;
  // 2564 curriculum: CLOs were copied from 2569 and are not confirmed with the faculty yet.
  preliminary?: boolean;
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
    <div className="space-y-2 rounded-md bg-slate-50 p-3 text-xs leading-5 text-muted-foreground">
      <p className="flex items-center gap-1.5 font-medium text-primary">
        <Info size={14} aria-hidden="true" className="shrink-0" />
        ตัวเลขนี้มาจากไหน
      </p>
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
        <ul className="grid grid-cols-1 gap-x-4 gap-y-0.5 border-t border-slate-200 pt-2 sm:grid-cols-2">
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
      {preliminary && <p className="font-medium text-amber-700">{PRELIMINARY_CLO_NOTE}</p>}
    </div>
  );
}
