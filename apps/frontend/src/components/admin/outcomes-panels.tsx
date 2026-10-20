'use client';

import type { ReactNode } from 'react';
import { Info, ListChecks, Pencil, Plus, type LucideIcon } from 'lucide-react';
import type { CloDetail, CourseListItem } from '@eduanalyze-ai/shared-types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  COURSE_FLAG_LABELS,
  OUTCOME_EFFECT_WARNING,
  chipLabel,
  courseFlag,
  type CourseRow,
  type OutcomeStats,
  type PloChip,
} from './outcomes-view';

// The look of the CLO/PLO page, split from the page so the page keeps the data and the actions.

// One quiet line instead of a banner; the note applies to everything on the page.
export function EffectNote() {
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <Info size={14} aria-hidden="true" className="shrink-0" />
      {OUTCOME_EFFECT_WARNING}
    </p>
  );
}

export function StatsStrip({ stats }: Readonly<{ stats: OutcomeStats }>) {
  const items = [
    { label: 'วิชาทั้งหมด', value: stats.courses, accent: false },
    { label: 'วิชาที่มี CLO', value: stats.coursesWithClo, accent: false },
    { label: 'CLO ที่ยังไม่ยืนยัน', value: stats.unconfirmed, accent: stats.unconfirmed > 0 },
  ];
  return (
    <dl className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border bg-card px-3 py-3 shadow-sm sm:px-4">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd
            className={cn(
              'mt-1 text-2xl font-semibold tabular-nums',
              item.accent ? 'text-amber-600' : 'text-primary',
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Underline tabs: the active one carries a brand bar under it.
export function UnderlineTabs<T extends string>({
  value,
  onChange,
  tabs,
}: Readonly<{ value: T; onChange: (value: T) => void; tabs: readonly (readonly [T, string])[] }>) {
  return (
    <div role="tablist" aria-label="เลือกดู" className="flex gap-6 border-b">
      {tabs.map(([key, text]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={cn(
            '-mb-px min-h-11 border-b-2 px-1 text-sm font-semibold transition-colors motion-reduce:transition-none',
            value === key
              ? 'border-brand text-brand'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

const FLAG_DOT = { NO_CLO: 'bg-slate-300', UNCONFIRMED: 'bg-amber-500' } as const;

export function CourseListItemButton({
  row,
  active,
  onSelect,
}: Readonly<{ row: CourseRow; active: boolean; onSelect: () => void }>) {
  const flag = courseFlag(row);
  return (
    <button
      type="button"
      aria-current={active ? 'true' : undefined}
      onClick={onSelect}
      className={cn(
        'flex min-h-11 w-full items-start gap-3 border-l-4 px-3 py-2.5 text-left transition-colors motion-reduce:transition-none',
        active ? 'border-brand bg-brand-light' : 'border-transparent hover:bg-muted',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-xs tabular-nums text-muted-foreground">{row.course.code}</span>
        <span className="course-name-break block text-sm font-medium leading-snug">
          {row.course.name}
        </span>
        {flag && (
          <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', FLAG_DOT[flag])} />
            {COURSE_FLAG_LABELS[flag]}
          </span>
        )}
      </span>
      <span
        aria-label={`${row.cloCount} CLO`}
        className={cn(
          'mt-0.5 inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums',
          row.cloCount > 0 ? 'bg-muted text-foreground' : 'bg-muted/60 text-muted-foreground',
        )}
      >
        {row.cloCount}
      </span>
    </button>
  );
}

export function CourseHeading({
  course,
  cloCount,
  actions,
}: Readonly<{ course: CourseListItem; cloCount: number; actions: ReactNode }>) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="course-name-break text-lg font-semibold leading-snug text-primary">
          {course.name}
        </h2>
        <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
          {course.code} · {course.credits} หน่วยกิต · {cloCount} CLO
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

export function CloCard({
  clo,
  chips,
  onEdit,
  onConfirm,
  disabled,
}: Readonly<{
  clo: CloDetail;
  chips: PloChip[];
  onEdit: () => void;
  onConfirm: () => void;
  disabled: boolean;
}>) {
  return (
    <article className="rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md motion-reduce:transition-none sm:p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-base font-bold">{clo.code}</h3>
          <Badge tone={clo.isConfirmed ? 'success' : 'warning'}>
            {clo.isConfirmed ? 'ยืนยันแล้ว' : 'ยังไม่ยืนยัน'}
          </Badge>
          <span className="text-xs tabular-nums text-muted-foreground">
            {clo.achievementThreshold === null
              ? 'เกณฑ์ผ่าน: ตามหลักสูตร'
              : `เกณฑ์ผ่าน: ร้อยละ ${clo.achievementThreshold}`}
          </span>
        </div>
        <Button
          variant="outline"
          className="h-9 min-h-9 w-9 shrink-0 p-0"
          aria-label={`แก้ไข ${clo.code}`}
          onClick={onEdit}
        >
          <Pencil size={14} aria-hidden="true" />
        </Button>
      </header>
      <p className="mt-3 break-words text-[15px] leading-relaxed">{clo.description}</p>
      <footer className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
        <span className="text-xs font-medium text-muted-foreground">PLO ที่ตอบ</span>
        {chips.length === 0 ? (
          <span className="text-xs text-muted-foreground">ยังไม่ได้เลือก</span>
        ) : (
          chips.map((chip) => (
            <span
              key={chip.ploId}
              className="inline-flex items-center rounded-md bg-brand-light px-2 py-1 text-xs font-semibold text-brand"
            >
              {chipLabel(chip)}
            </span>
          ))
        )}
        {!clo.isConfirmed && (
          <Button
            variant="ghost"
            className="ml-auto h-9 min-h-9 px-3 text-brand"
            disabled={disabled}
            onClick={onConfirm}
          >
            ยืนยัน CLO นี้
          </Button>
        )}
      </footer>
    </article>
  );
}

// A large faint icon and two short lines saying what to do next.
export function EmptyPane({
  icon: Icon = ListChecks,
  title,
  hint,
  onAdd,
}: Readonly<{ icon?: LucideIcon; title: string; hint: string; onAdd?: () => void }>) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-14 text-center">
      <Icon size={48} strokeWidth={1.25} aria-hidden="true" className="text-muted-foreground/40" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{hint}</p>
      {onAdd && (
        <Button className="mt-4" onClick={onAdd}>
          <Plus size={16} aria-hidden="true" className="mr-1.5" />
          เพิ่ม CLO แรก
        </Button>
      )}
    </div>
  );
}
