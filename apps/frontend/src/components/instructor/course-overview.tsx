'use client';

import { useId, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Info } from 'lucide-react';
import type { InstructorCourseSummary } from '@eduanalyze-ai/shared-types';
import {
  fetchInstructorCourseTimeline,
  fetchInstructorStudents,
  fetchInstructorYearLevels,
} from '@/lib/api/instructor';
import {
  EMPTY_SNAPSHOT,
  SPARSE_LABEL,
  SPARSE_TREND,
  SPARSE_YEAR_NOTE,
  MIN_TERMS_FOR_TREND,
  buildCourseSnapshot,
  changeLine,
  courseTermInfo,
  dataLevelOf,
  formatPointsChange,
  summaryLine,
  type CourseSnapshot,
  type GoalItem,
  type YearRow,
} from '@/lib/course-snapshot';
import { yearLevelLabel } from '@/lib/course-timeline-summary';
import { formatPercent } from '@/lib/format-percent';
import {
  formatCourseGpa,
  formatGradeList,
  formatGradeTally,
  formatMedian,
  gradeText,
  summarizeGradeCenter,
} from '@/lib/grade-center';
import { showAchievementRing } from '@/lib/progress-ring-geometry';
import { GRADE_LABELS } from '@/lib/grade-label';
import { formatGpa } from '@/lib/instructor-overview';
import { cn } from '@/lib/utils';
import { PageSection } from '@/components/layout/page-section';
import { RevealOnScroll } from '@/components/layout/reveal-on-scroll';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { AnimatedRing } from '@/components/ui/animated-ring';
import { ApiErrorAlert } from '@/components/admin/api-error-alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CARD, CARD_PAD, TEXT_LABEL, TEXT_SECTION } from './instructor-ui';
import { LowSampleTag } from './overview-parts';
import { StatTile } from './stat-tile';

// One hue, strongest for A and faintest for F, so the order reads without a
// rainbow. The theme-aware blue steps keep that order in both themes (the dark
// theme mirrors the scale, so A stays the most prominent bar). Every row also
// carries the grade, the count and the share in words, so colour is never the
// only signal.
const GRADE_FILL: Record<string, string> = {
  A: 'bg-blue-900',
  B_PLUS: 'bg-blue-800',
  B: 'bg-blue-700',
  C_PLUS: 'bg-blue-600',
  C: 'bg-blue-500',
  D_PLUS: 'bg-blue-400',
  D: 'bg-blue-300',
  F: 'bg-blue-200',
};

const oneDecimal = (n: number) => `${n.toFixed(1)}%`;

// A titled card: heading and a short line on the left, a reference on the right.
function SectionCard({
  title,
  description,
  aside,
  footer,
  children,
}: Readonly<{
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}>) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={CARD}>
      <div className="flex flex-col gap-1 border-b px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 id={headingId} className={TEXT_SECTION}>
            {title}
          </h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {aside && <div className="shrink-0 text-xs text-muted-foreground">{aside}</div>}
      </div>
      <div className={`space-y-4 ${CARD_PAD}`}>{children}</div>
      {footer && (
        <div className="flex items-start gap-2 rounded-b-xl border-t bg-slate-50 px-5 py-3 text-xs text-muted-foreground">
          <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          <div className="space-y-1">{footer}</div>
        </div>
      )}
    </section>
  );
}

// One course, read the same way on the dashboard and on the course page. The
// numbers all come from buildCourseSnapshot, so the two pages cannot differ.
// Which course it is (name, term, actions) is the CourseHero's job.
export function CourseOverview({ course }: Readonly<{ course: InstructorCourseSummary }>) {
  // Same keys as the other instructor pages: one cached request each.
  const studentsQuery = useQuery({
    queryKey: ['instructor-students'],
    queryFn: () => fetchInstructorStudents({}),
  });
  const yearLevelsQuery = useQuery({
    queryKey: ['instructor-year-levels'],
    queryFn: fetchInstructorYearLevels,
  });
  const timelineQuery = useQuery({
    queryKey: ['instructor-course-timeline'],
    queryFn: fetchInstructorCourseTimeline,
  });

  const seatRows = useMemo(
    () => (studentsQuery.data?.students ?? []).filter((s) => s.courseId === course.courseId),
    [studentsQuery.data, course.courseId],
  );
  const yearLevelByStudent = useMemo(() => {
    if (!yearLevelsQuery.data || !studentsQuery.data) return null;
    const map = new Map<string, number>();
    for (const bucket of yearLevelsQuery.data.buckets) {
      for (const s of bucket.students) map.set(s.studentProfileId, bucket.yearLevel);
    }
    return map;
  }, [yearLevelsQuery.data, studentsQuery.data]);

  const snapshot = useMemo(
    () => buildCourseSnapshot({ course, seatRows, yearLevelByStudent }),
    [course, seatRows, yearLevelByStudent],
  );
  const termInfo = useMemo(
    () => (timelineQuery.data ? courseTermInfo(timelineQuery.data.years, course.courseId) : null),
    [timelineQuery.data, course.courseId],
  );
  const yearsLoading = studentsQuery.isLoading || yearLevelsQuery.isLoading;
  const yearsFailed = studentsQuery.isError || yearLevelsQuery.isError;

  return (
    <div className="space-y-6">
      {snapshot.empty ? (
        <section className={`${CARD} ${CARD_PAD}`}>
          <p className="text-sm text-muted-foreground">{EMPTY_SNAPSHOT}</p>
        </section>
      ) : (
        <>
          <SummarySection snapshot={snapshot} termLabel={termInfo?.termLabel} />
          {yearsFailed && (
            <ApiErrorAlert
              message="โหลดข้อมูลแยกตามชั้นปีไม่สำเร็จ ตัวเลขส่วนอื่นของวิชานี้ยังแสดงได้ตามปกติ"
              onRetry={() => {
                void studentsQuery.refetch();
                void yearLevelsQuery.refetch();
              }}
            />
          )}
          <YearSection snapshot={snapshot} loading={yearsLoading} />
          <RevealOnScroll>
            <GoalsSection snapshot={snapshot} />
          </RevealOnScroll>
          <RevealOnScroll>
            <GradesSection snapshot={snapshot} />
          </RevealOnScroll>
          <RevealOnScroll>
            <TrendSection snapshot={snapshot} />
          </RevealOnScroll>
        </>
      )}
    </div>
  );
}

function SummarySection({
  snapshot,
  termLabel,
}: Readonly<{ snapshot: CourseSnapshot; termLabel?: string }>) {
  const { stats } = snapshot;
  const headingId = useId();
  const center = useMemo(() => summarizeGradeCenter(stats.counts), [stats.counts]);
  const values = center.values;
  return (
    <section aria-labelledby={headingId} className={CARD}>
      <div className="flex flex-wrap items-end justify-between gap-2 border-b px-5 py-4">
        <h2 id={headingId} className={TEXT_SECTION}>
          สรุปผล
        </h2>
        {termLabel && <p className={TEXT_LABEL}>รอบล่าสุด {termLabel}</p>}
      </div>
      <div className={`space-y-5 ${CARD_PAD}`}>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <StatTile
            big
            className="col-span-2"
            label="GPA ของวิชา"
            zero={!values}
            value={
              values ? (
                center.level === 'ok' ? (
                  <AnimatedNumber value={values.gpa} decimals={2} format={formatCourseGpa} />
                ) : (
                  formatCourseGpa(values.gpa)
                )
              ) : (
                '—'
              )
            }
            extra={
              values ? (
                <>
                  <span className="text-sm text-muted-foreground">
                    ≈ เกรด {gradeText(values.nearest)} (จาก 4.00)
                  </span>
                  {center.level === 'low' && <LowSampleTag counted={center.people} />}
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {formatGradeTally(stats.counts)}
                </span>
              )
            }
          />
          <StatTile
            label="นิสิตที่มีเกรด"
            unit="คน"
            zero={stats.seats === 0}
            value={<AnimatedNumber value={stats.seats} />}
          />
          <StatTile
            label="ได้ B ขึ้นไป"
            unit="คน"
            zero={stats.achieved === 0}
            value={<AnimatedNumber value={stats.achieved} />}
          />
          <StatTile
            label="ได้ F"
            unit="คน"
            zero={stats.f === 0}
            value={<AnimatedNumber value={stats.f} />}
          />
          <StatTile
            label="ถอน (W)"
            unit="คน"
            zero={stats.w === 0}
            value={<AnimatedNumber value={stats.w} />}
          />
        </dl>

        {values && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4 border-t pt-5">
            {showAchievementRing(stats.graded, stats.achievedPercent) && (
              <AnimatedRing percent={stats.achievedPercent}>
                <span className="text-center text-xs font-medium leading-tight text-muted-foreground">
                  B<br />
                  ขึ้นไป
                </span>
              </AnimatedRing>
            )}
            <div className="min-w-0 flex-1 basis-64 space-y-3 border-brand lg:border-l-4 lg:pl-5">
              <p className="text-sm font-medium text-primary">{summaryLine(snapshot)}</p>
              <details className="group rounded-md border bg-slate-50 px-3">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  รายละเอียดการกระจายของเกรด
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  />
                </summary>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 pb-3 sm:grid-cols-3">
                  <Figure small label="เกรดที่พบมากที่สุด" value={formatGradeList(values.modes)} />
                  <Figure small label="เกรดกลาง" value={formatMedian(values.median)} />
                  <Figure small label="เกรดสูงสุดที่พบ" value={gradeText(values.highest)} />
                  <Figure small label="เกรดต่ำสุดที่พบ" value={gradeText(values.lowest)} />
                  <Figure
                    small
                    label="ส่วนเบี่ยงเบนมาตรฐานของแต้มเกรด"
                    value={values.stdDev.toFixed(2)}
                    note="ยิ่งมาก เกรดยิ่งกระจายห่างกัน"
                  />
                </dl>
              </details>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Figure({
  label,
  value,
  note,
  small = false,
}: Readonly<{
  label: string;
  value: ReactNode;
  note?: string;
  small?: boolean;
}>) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'break-words font-semibold tabular-nums text-primary',
          small ? 'text-lg' : 'text-2xl',
        )}
      >
        {value}
      </dd>
      {note && <dd className="text-xs text-muted-foreground">{note}</dd>}
    </div>
  );
}

function YearSection({
  snapshot,
  loading,
}: Readonly<{ snapshot: CourseSnapshot; loading: boolean }>) {
  const { years } = snapshot;
  const hasSparse = !!years && years.rows.some((r) => !r.showNumbers);
  const footer =
    years && (hasSparse || years.unplaced > 0) ? (
      <>
        {hasSparse && <p>{SPARSE_YEAR_NOTE}</p>}
        {years.unplaced > 0 && <p>{years.unplaced} คนหาชั้นปีไม่พบ จึงไม่อยู่ในตารางนี้</p>}
      </>
    ) : undefined;
  let body: ReactNode;
  if (loading) {
    body = <Skeleton className="h-28 w-full rounded-xl" />;
  } else if (years === null) {
    body = (
      <p className="text-sm text-muted-foreground">
        ยังโหลดข้อมูลชั้นปีไม่ได้ จึงยังแยกตามชั้นปีไม่ได้
      </p>
    );
  } else if (years.rows.length === 0) {
    body = (
      <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลชั้นปีของนิสิตในวิชานี้</p>
    );
  } else {
    body = (
      <>
        <div className="-mx-5 -my-5 hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">ชั้นปี</th>
                <th className="px-5 py-2.5 text-right font-medium">มีเกรด (คน)</th>
                <th className="px-5 py-2.5 text-right font-medium">ได้ B ขึ้นไป</th>
                <th className="px-5 py-2.5 text-right font-medium">เกรดเฉลี่ย</th>
                <th className="px-5 py-2.5 font-medium">เกรดกลาง</th>
              </tr>
            </thead>
            <tbody>
              {years.rows.map((row) => (
                <tr key={row.yearLevel} className="border-b last:border-0">
                  <td className="px-5 py-3.5 text-base font-bold text-primary">
                    {yearLevelLabel(row.yearLevel)}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums">{row.stats.seats}</td>
                  <td className="px-5 py-3.5 text-right text-lg font-semibold tabular-nums text-primary">
                    {row.showNumbers ? formatPercent(row.stats.achievedPercent) : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums">
                    {row.showNumbers ? formatGpa(row.stats.gpa) : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <span className="text-base font-semibold tabular-nums text-primary">
                        {medianOf(row) ?? '—'}
                      </span>
                      {row.level === 'low' && <LowSampleTag counted={row.stats.graded} />}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="-my-1 divide-y md:hidden">
          {years.rows.map((row) => (
            <YearListItem key={row.yearLevel} row={row} />
          ))}
        </ul>
      </>
    );
  }
  return (
    <SectionCard
      title="ภาพรวมตามชั้นปี"
      description="ชั้นปีของนิสิตเทียบกับปีการศึกษาล่าสุด แสดงเฉพาะชั้นปีที่มีนิสิตในวิชานี้"
      footer={footer}
    >
      {body}
    </SectionCard>
  );
}

// The middle grade of one year level; null while there are too few people.
function medianOf(row: YearRow): string | null {
  const values = summarizeGradeCenter(row.stats.counts).values;
  return values && row.showNumbers ? formatMedian(values.median) : null;
}

function YearListItem({ row }: Readonly<{ row: YearRow }>) {
  const median = medianOf(row);
  return (
    <li className="space-y-1 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-bold text-primary">{yearLevelLabel(row.yearLevel)}</p>
        {row.level === 'low' && <LowSampleTag counted={row.stats.graded} />}
      </div>
      <p className="text-sm text-muted-foreground">
        {row.showNumbers
          ? `ได้ B ขึ้นไป ${formatPercent(row.stats.achievedPercent)} · เกรดเฉลี่ย ${formatGpa(row.stats.gpa)}${median ? ` · เกรดกลาง ${median}` : ''} · ${row.stats.seats} คน`
          : `มีเกรด ${row.stats.seats} คน · ตัวเลข —`}
      </p>
    </li>
  );
}

function GoalRow({ goal }: Readonly<{ goal: GoalItem }>) {
  return (
    <li className="py-3">
      <p className="break-words text-sm text-primary">
        <span className="font-semibold">{goal.code}</span> {goal.description}
      </p>
    </li>
  );
}

// The goals of the course in code order. The backend has no share per goal, so
// nothing here is judged; the notes only say how much to trust the course share.
function GoalsSection({ snapshot }: Readonly<{ snapshot: CourseSnapshot }>) {
  const { goals, level, stats } = snapshot;
  return (
    <SectionCard
      title="เป้าการเรียนรู้"
      aside={level === 'low' ? <LowSampleTag counted={stats.graded} /> : undefined}
    >
      {goals.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีเป้าการเรียนรู้ที่กำหนดไว้ในวิชานี้</p>
      ) : (
        <ul className="-my-3 divide-y divide-slate-100">
          {goals.items.map((goal) => (
            <GoalRow key={goal.cloId} goal={goal} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function GradesSection({ snapshot }: Readonly<{ snapshot: CourseSnapshot }>) {
  const { grades } = snapshot;
  if (grades.scored === 0) {
    return (
      <SectionCard title="การกระจายเกรด">
        <p className="text-sm text-muted-foreground">ยังไม่มีเกรด A ถึง F</p>
      </SectionCard>
    );
  }
  // Under 5 people a bar shows nothing a count does not: chips, no chart.
  const fewPeople = dataLevelOf(grades.scored) === 'insufficient';
  return (
    <SectionCard
      title="การกระจายเกรด"
      description="เกรดล่าสุดของนิสิตแต่ละคนในวิชานี้ (A ถึง F)"
      aside={`รวม A ถึง F ${grades.scored} คน`}
    >
      {fewPeople ? (
        <ul className="flex flex-wrap gap-2">
          {grades.segments
            .filter((s) => s.count > 0)
            .map((s) => (
              <li
                key={s.grade}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 px-3 text-sm"
              >
                <span className="font-semibold text-primary">{GRADE_LABELS[s.grade]}</span>
                <span className="tabular-nums text-muted-foreground">{s.count} คน</span>
              </li>
            ))}
        </ul>
      ) : (
        <ul className="space-y-2">
          {grades.segments.map((s) => (
            <li
              key={s.grade}
              className={cn('flex items-center gap-3', s.count === 0 && 'text-muted-foreground')}
            >
              <span className="w-8 shrink-0 text-sm font-semibold tabular-nums text-primary">
                {GRADE_LABELS[s.grade]}
              </span>
              <div
                role="img"
                aria-label={`${GRADE_LABELS[s.grade]} ${s.count} คน ${oneDecimal(s.percent)}`}
                className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100"
              >
                <span
                  className={cn('block h-full rounded-full', GRADE_FILL[s.grade])}
                  style={{
                    width: `${s.count === 0 ? 0 : Math.max(2, Math.min(100, s.percent))}%`,
                  }}
                />
              </div>
              <span className="w-28 shrink-0 text-right text-sm tabular-nums">
                <span className="font-semibold text-primary">{s.count}</span>{' '}
                <span className="text-muted-foreground">คน · {oneDecimal(s.percent)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t pt-3 text-sm text-muted-foreground">
        ได้ F <span className="font-semibold text-primary">{grades.f}</span> คน · ถอน (W){' '}
        <span className="font-semibold text-primary">{grades.w}</span> คน · ยังไม่สมบูรณ์ (I){' '}
        <span className="font-semibold text-primary">{grades.incomplete}</span> คน
        {grades.notGraded > 0 && (
          <>
            {' '}
            · ไม่คิดเกรด (S, U){' '}
            <span className="font-semibold text-primary">{grades.notGraded}</span> คน
          </>
        )}
      </p>
    </SectionCard>
  );
}

function TrendSection({ snapshot }: Readonly<{ snapshot: CourseSnapshot }>) {
  const { trend } = snapshot;
  return (
    <SectionCard
      title="แนวโน้มรายภาคเรียน"
      description={trend.enough && trend.change ? changeLine(trend.change) : undefined}
    >
      {trend.enough ? (
        <ul className="grid gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-3">
          {trend.terms.map((term) => (
            <li
              key={term.key}
              className={cn(
                'relative space-y-2 rounded-xl border p-4',
                term.isLatest ? 'border-2 border-brand bg-brand-light' : 'bg-card',
              )}
            >
              {term.isLatest && (
                <span className="absolute -top-3 right-3 rounded-md bg-brand px-2 py-0.5 text-xs font-medium text-brand-foreground">
                  ภาคล่าสุด
                </span>
              )}
              <p className="text-sm font-semibold text-primary">{term.label}</p>
              {term.showNumbers ? (
                <>
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-4xl font-bold leading-none tabular-nums text-primary">
                      {formatPercent(term.percent)}
                    </span>
                    <span className="text-sm text-muted-foreground">ได้ B ขึ้นไป</span>
                  </p>
                  <div
                    role="img"
                    aria-label={`ได้ B ขึ้นไป ${formatPercent(term.percent)}`}
                    className="h-2 overflow-hidden rounded-full bg-slate-100"
                  >
                    <span
                      className={cn(
                        'block h-full rounded-full',
                        term.isLatest ? 'bg-brand' : 'bg-slate-400',
                      )}
                      style={{
                        width: `${Math.min(100, Math.max(0, term.percent))}%`,
                      }}
                    />
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{SPARSE_LABEL} · ตัวเลข —</p>
              )}
              <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                มีเกรด {term.students} คน
                {term.level === 'low' && <LowSampleTag counted={term.graded} />}
              </p>
              {term.delta !== null && (
                <Badge tone="neutral" className="px-2.5 py-1 text-xs">
                  % B ขึ้นไป เทียบภาคก่อน {formatPointsChange(term.delta)} จุด
                </Badge>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          {SPARSE_TREND} (มี {trend.termCount} ภาคเรียน ต้องมีอย่างน้อย {MIN_TERMS_FOR_TREND}{' '}
          ภาคเรียน)
        </p>
      )}
    </SectionCard>
  );
}
