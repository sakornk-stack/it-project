'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, GraduationCap } from 'lucide-react';
import type { YearLevelBucket } from '@eduanalyze-ai/shared-types';
import { LOW_GRADE_LABEL, LOW_GRADE_RULE } from '@/lib/low-grade';
import { usePagination } from '@/lib/use-pagination';
import { cn } from '@/lib/utils';
import { Reveal } from '@/components/layout/reveal';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { CARD } from './instructor-ui';
import {
  STUDENT_CARD_MAIN,
  StudentCardFrame,
  StudentCardGrid,
  StudentIdentity,
} from './student-card';

const PAGE_SIZE = 12;

type Student = YearLevelBucket['students'][number];

// Instructor-only stand-in for the shared YearLevelOverview (which Staff also
// uses and must not change). Year cards that open that year's student list, with
// the low-grade and behind-plan counts on each card; the list uses the student
// card of the students page and links straight to that student there. The set is
// null when the students report is unavailable; the page then shows no such
// badges. Which year is open is plain component state, not the URL.
export function InstructorYearLevelOverview({
  buckets,
  lowIds,
}: Readonly<{
  buckets: YearLevelBucket[];
  lowIds: ReadonlySet<string> | null;
}>) {
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null);
  const expandedBucket = buckets.find((b) => b.yearLevel === expandedLevel);

  return (
    <div className="space-y-6">
      {/* 4 columns only from xl: with the sidebar, lg leaves ~164px per card. */}
      <ul className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {buckets.map((bucket, index) => {
          const isExpanded = expandedLevel === bucket.yearLevel;
          const count = bucket.students.length;
          const empty = count === 0;
          const behindCount = bucket.students.filter((s) => s.onTrackStatus === 'behind').length;
          const lowCount = bucket.students.filter((s) => lowIds?.has(s.studentProfileId)).length;
          return (
            <li key={bucket.yearLevel} className="h-full">
              <Reveal index={index} className="h-full">
                <button
                  type="button"
                  disabled={empty}
                  aria-expanded={isExpanded}
                  aria-controls={isExpanded ? 'year-level-students' : undefined}
                  onClick={() => setExpandedLevel(isExpanded ? null : bucket.yearLevel)}
                  className={cn(
                    CARD,
                    'flex h-full min-h-11 w-full flex-col gap-2 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:p-5',
                    empty ? 'cursor-not-allowed opacity-60' : 'interactive-card',
                    isExpanded && 'border-brand bg-brand-light ring-1 ring-brand',
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-primary">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        empty ? 'bg-slate-100 text-slate-500' : 'bg-brand-light text-brand',
                        isExpanded && 'bg-card',
                      )}
                    >
                      <GraduationCap size={16} />
                    </span>
                    <span className="min-w-0 flex-1 truncate" title={bucket.label}>
                      {bucket.label}
                    </span>
                    {!empty && (
                      <ChevronDown
                        aria-hidden="true"
                        className={cn(
                          'go-arrow h-4 w-4 shrink-0 text-brand transition-transform motion-reduce:transition-none',
                          isExpanded && 'rotate-180',
                        )}
                      />
                    )}
                  </span>
                  <span
                    className={cn(
                      'text-3xl font-semibold leading-none tabular-nums',
                      empty ? 'text-muted-foreground' : 'text-primary',
                    )}
                  >
                    <AnimatedNumber value={count} />
                    <span className="ml-1 text-sm font-normal text-muted-foreground">คน</span>
                  </span>
                  {(lowCount > 0 || behindCount > 0) && (
                    <span className="flex flex-wrap gap-1.5">
                      {lowCount > 0 && (
                        <Badge tone="warning" className="whitespace-nowrap">
                          {LOW_GRADE_LABEL} {lowCount}
                        </Badge>
                      )}
                      {behindCount > 0 && (
                        <Badge tone="warning" className="whitespace-nowrap">
                          หน่วยกิตน้อยกว่าที่ควรมี {behindCount}
                        </Badge>
                      )}
                    </span>
                  )}
                </button>
              </Reveal>
            </li>
          );
        })}
      </ul>

      {expandedBucket && (
        <Reveal index={0}>
          <YearLevelStudents
            key={expandedBucket.yearLevel}
            bucket={expandedBucket}
            lowIds={lowIds}
          />
        </Reveal>
      )}
    </div>
  );
}

function YearLevelStudents({
  bucket,
  lowIds,
}: Readonly<{ bucket: YearLevelBucket; lowIds: ReadonlySet<string> | null }>) {
  const isLow = (s: Student) => lowIds?.has(s.studentProfileId) ?? false;
  // Low grades first; the sort is stable, so the order the API gave is kept within each group.
  const students = [...bucket.students].sort((a, b) => Number(isLow(b)) - Number(isLow(a)));
  const pagination = usePagination(students, PAGE_SIZE);

  return (
    <div id="year-level-students" className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-primary">รายชื่อนิสิต — {bucket.label}</h3>
        <p className="text-sm text-muted-foreground">
          {LOW_GRADE_LABEL}: {LOW_GRADE_RULE} นับเฉพาะวิชาที่คุณสอน
          กดการ์ดเพื่อดูนิสิตคนนั้นในหน้านิสิต
        </p>
      </div>
      <StudentCardGrid>
        {pagination.pageRows.map((s) => {
          const low = isLow(s);
          const behind = s.onTrackStatus === 'behind';
          return (
            <li key={s.studentProfileId} className="h-full">
              <StudentCardFrame accent={low ? 'warning' : null} accentNote={LOW_GRADE_LABEL}>
                <Link
                  href={`/instructor/students?q=${encodeURIComponent(s.studentCode)}`}
                  aria-label={low ? `${s.fullName} ${s.studentCode} ${LOW_GRADE_LABEL}` : undefined}
                  className={STUDENT_CARD_MAIN}
                >
                  <StudentIdentity
                    name={s.fullName}
                    code={s.studentCode}
                    meta={`เข้าศึกษาปี ${s.admissionYear}`}
                  />
                  {(low || behind) && (
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {low && <Badge tone="warning">{LOW_GRADE_LABEL}</Badge>}
                      {behind && (
                        <span title="หน่วยกิตน้อยกว่าที่ควรมี">
                          <Badge tone="warning">หน่วยกิตน้อย</Badge>
                        </span>
                      )}
                    </span>
                  )}
                  <ChevronRight
                    aria-hidden="true"
                    className="go-arrow h-4 w-4 shrink-0 text-muted-foreground"
                  />
                </Link>
              </StudentCardFrame>
            </li>
          );
        })}
      </StudentCardGrid>
      <Pagination {...pagination} unit="คน" onPageChange={pagination.setPage} />
    </div>
  );
}
