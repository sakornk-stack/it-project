'use client';

import Link from 'next/link';
import { ArrowRight, FolderOpen, Search } from 'lucide-react';
import type { AdminScopeCurriculumEntry } from '@eduanalyze-ai/shared-types';
import {
  CURRICULUM_TAB_LABELS,
  CURRICULUM_TAB_ORDER,
  placeOf,
  type CurriculumTab,
  type ProgramPlace,
} from '@/lib/admin-curricula';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import type { SemanticTone } from '@/lib/tone';

const STATE_BADGE: Record<
  AdminScopeCurriculumEntry['dataState'],
  { tone: SemanticTone; label: (entry: AdminScopeCurriculumEntry) => string }
> = {
  HAS_STUDENTS: { tone: 'success', label: (e) => `มีนิสิต ${e.studentCount} คน` },
  STRUCTURE_ONLY: { tone: 'warning', label: () => 'มีแต่โครงสร้าง' },
  EMPTY: { tone: 'neutral', label: () => 'ว่าง (ยังไม่มีข้อมูล)' },
};

const STATE_NOTE: Record<AdminScopeCurriculumEntry['dataState'], string> = {
  HAS_STUDENTS: 'มีนิสิตในหลักสูตรนี้แล้ว',
  STRUCTURE_ONLY: 'จัดโครงสร้างแล้ว แต่ยังไม่มีนิสิต',
  EMPTY: 'ยังไม่มีรายวิชาและนิสิต',
};

export function CurriculumTabs({
  value,
  counts,
  onChange,
}: Readonly<{
  value: CurriculumTab;
  counts: Record<CurriculumTab, number>;
  onChange: (tab: CurriculumTab) => void;
}>) {
  return (
    <div
      role="tablist"
      aria-label="กรองหลักสูตรตามสถานะข้อมูล"
      className="flex flex-wrap gap-1 rounded-lg border bg-card p-1"
    >
      {CURRICULUM_TAB_ORDER.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={value === tab}
          onClick={() => onChange(tab)}
          className={cn(
            'min-h-11 rounded-md px-3.5 text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none',
            value === tab
              ? 'bg-brand text-brand-foreground'
              : 'text-muted-foreground hover:bg-slate-50',
          )}
        >
          {CURRICULUM_TAB_LABELS[tab]} ({counts[tab]})
        </button>
      ))}
    </div>
  );
}

// Card weight follows how much there is to look at: a curriculum with students leads,
// one with only structure is plain, an empty one is quieter (soft fill, dashed edge).
const CARD_EMPHASIS: Record<AdminScopeCurriculumEntry['dataState'], string> = {
  HAS_STUDENTS: 'border-brand/40 shadow-sm',
  STRUCTURE_ONLY: '',
  EMPTY: 'border-dashed bg-muted/40 shadow-none',
};

// The whole card is one link: the "ดูคุณภาพหลักสูตร" link stretches over it, so there is a
// single tab stop and a single accessible name, and no link nests inside another.
function CurriculumCard({
  entry,
  programs,
}: Readonly<{ entry: AdminScopeCurriculumEntry; programs: readonly ProgramPlace[] }>) {
  const place = placeOf(entry, programs);
  const badge = STATE_BADGE[entry.dataState];
  return (
    <Card
      className={cn(
        'relative flex h-full flex-col transition-[transform,box-shadow] duration-200 ease-out focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2 md:hover:-translate-y-0.5 md:hover:shadow-md motion-reduce:transition-none motion-reduce:md:hover:translate-y-0',
        CARD_EMPHASIS[entry.dataState],
      )}
    >
      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Badge tone="neutral">
            {entry.programCode} · ฉบับ {entry.version} (พ.ศ. {entry.effectiveYear})
          </Badge>
          <Badge tone={badge.tone}>{badge.label(entry)}</Badge>
        </div>
        <h3
          className={cn(
            'text-base font-semibold leading-snug',
            entry.dataState === 'EMPTY' ? 'text-muted-foreground' : 'text-primary',
          )}
        >
          {entry.programName}
        </h3>
        {place && (
          <p className="text-sm text-muted-foreground">
            {place.departmentName} · {place.facultyName}
          </p>
        )}
        <div className="mt-auto space-y-1 pt-2 text-sm text-muted-foreground">
          <p>{STATE_NOTE[entry.dataState]}</p>
          <p className="tabular-nums">
            {entry.courseCount} รายวิชา · {entry.ploCount} PLO
          </p>
        </div>
        <Link
          href={`/admin/curriculum/${entry.curriculumId}`}
          aria-label={`ดูคุณภาพหลักสูตร ${entry.programName} ฉบับ ${entry.version}`}
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'mt-2 w-full gap-1.5 after:absolute after:inset-0 after:content-[""] focus-visible:ring-0 focus-visible:ring-offset-0',
          )}
        >
          ดูคุณภาพหลักสูตร
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}

export function AdminCurriculumCards({
  entries,
  programs,
  filtered,
}: Readonly<{
  entries: readonly AdminScopeCurriculumEntry[];
  programs: readonly ProgramPlace[];
  // True when a search or tab has narrowed the list, so "nothing" reads as
  // "no match" rather than "no curricula at all".
  filtered: boolean;
}>) {
  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={filtered ? Search : FolderOpen}
            description={
              filtered
                ? 'ไม่พบหลักสูตรที่ตรงกับตัวกรอง ลองเปลี่ยนแท็บหรือล้างคำค้นหา'
                : 'ยังไม่มีหลักสูตรในขอบเขตที่คุณดูแล'
            }
          />
        </CardContent>
      </Card>
    );
  }
  return (
    // Keyed by the shown set so a tab change fades the new cards in (off under reduced motion).
    <ul
      key={entries.map((entry) => entry.curriculumId).join()}
      className="grid grid-cols-1 gap-4 duration-200 animate-in fade-in-0 motion-reduce:animate-none md:grid-cols-2 xl:grid-cols-3"
    >
      {entries.map((entry) => (
        <li key={entry.curriculumId}>
          <CurriculumCard entry={entry} programs={programs} />
        </li>
      ))}
    </ul>
  );
}
