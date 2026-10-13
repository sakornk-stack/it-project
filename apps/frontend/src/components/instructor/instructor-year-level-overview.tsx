'use client';

import { useState } from 'react';
import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import type { YearLevelBucket } from '@eduanalyze-ai/shared-types';
import { LOW_GRADE_LABEL, LOW_GRADE_RULE } from '@/lib/low-grade';
import { cn } from '@/lib/utils';
import { Reveal } from '@/components/layout/reveal';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Instructor-only stand-in for the shared YearLevelOverview (which Staff also
// uses and must not change). Same idea — year cards that open that year's
// student list — plus a low-grade badge, and rows that are 44px tall links
// straight to that student on the students page. The set is null when the
// students report is unavailable; the page then simply shows no such badges. Which year is open is plain component state, not the URL.
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
    <div className="space-y-4">
      <Reveal index={1}>
        {/* 4 columns only from xl: with the sidebar, lg leaves ~164px per card. */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {buckets.map((bucket) => {
            const isExpanded = expandedLevel === bucket.yearLevel;
            const behindCount = bucket.students.filter((s) => s.onTrackStatus === 'behind').length;
            const lowCount = bucket.students.filter((s) => lowIds?.has(s.studentProfileId)).length;
            return (
              <button
                key={bucket.yearLevel}
                type="button"
                aria-expanded={isExpanded}
                onClick={() => setExpandedLevel(isExpanded ? null : bucket.yearLevel)}
                className={cn(
                  'interactive-card flex min-h-11 flex-col rounded-lg border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isExpanded ? 'border-brand bg-brand-light' : 'border-slate-200',
                )}
              >
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <GraduationCap className="h-4 w-4 text-brand" />
                  {bucket.label}
                </div>
                <p className="mt-2 text-2xl font-semibold text-primary">
                  <AnimatedNumber value={bucket.students.length} />
                </p>
                <p className="text-xs text-muted-foreground">คน</p>
                <div className="mt-2 flex flex-wrap gap-1.5 empty:hidden">
                  {lowCount > 0 && (
                    <Badge tone="warning" className="max-w-full shrink whitespace-normal">
                      {LOW_GRADE_LABEL} {lowCount}
                    </Badge>
                  )}
                  {behindCount > 0 && (
                    <Badge tone="warning" className="max-w-full shrink whitespace-normal">
                      หน่วยกิตน้อยกว่าที่ควรมี {behindCount}
                    </Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Reveal>

      {expandedBucket && (
        <Reveal index={2}>
          <Card>
            <CardHeader>
              <CardTitle>รายชื่อนิสิต — {expandedBucket.label}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {LOW_GRADE_LABEL}: {LOW_GRADE_RULE} นับเฉพาะวิชาที่คุณสอน
                กดชื่อเพื่อดูนิสิตคนนั้นในหน้านิสิต
              </p>
            </CardHeader>
            <CardContent>
              {expandedBucket.students.length === 0 ? (
                <p className="text-sm text-muted-foreground">ไม่มีนิสิตในชั้นปีนี้</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                  {[...expandedBucket.students]
                    .sort(
                      (a, b) =>
                        Number(lowIds?.has(b.studentProfileId) ?? false) -
                        Number(lowIds?.has(a.studentProfileId) ?? false),
                    )
                    .map((s) => {
                      const hasLow = lowIds?.has(s.studentProfileId) ?? false;
                      return (
                        <li key={s.studentProfileId}>
                          <Link
                            href={`/instructor/students?q=${encodeURIComponent(s.studentCode)}`}
                            className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 text-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className="min-w-0">
                              <span className="block text-primary">{s.fullName}</span>
                              <span className="block text-xs text-muted-foreground">
                                {s.studentCode} · เข้าศึกษาปี {s.admissionYear}
                              </span>
                            </span>
                            <span className="flex flex-wrap items-center gap-1.5">
                              {hasLow && <Badge tone="warning">{LOW_GRADE_LABEL}</Badge>}
                              {s.onTrackStatus === 'behind' && (
                                <Badge tone="warning">หน่วยกิตน้อยกว่าที่ควรมี</Badge>
                              )}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                </ul>
              )}
            </CardContent>
          </Card>
        </Reveal>
      )}
    </div>
  );
}
