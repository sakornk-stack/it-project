'use client';

import { useId, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Info, MinusCircle, Star, Target, TrendingUp, Users, XCircle } from 'lucide-react';
import type { InstructorCourseSummary } from '@eduanalyze-ai/shared-types';
import {
  fetchInstructorCourseTimeline,
  fetchInstructorStudents,
  fetchInstructorYearLevels,
} from '@/lib/api/instructor';
import {
  EMPTY_SNAPSHOT,
  SPARSE_TREND,
  SPARSE_YEAR_NOTE,
  MIN_TERMS_FOR_TREND,
  buildCourseSnapshot,
  courseTermInfo,
  dataLevelOf,
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
import { gradeBarClassName } from '@/lib/grade-badge-color';
import { formatGpa } from '@/lib/instructor-overview';
import { cn } from '@/lib/utils';
import { PageSection } from '@/components/layout/page-section';
import { RevealOnScroll } from '@/components/layout/reveal-on-scroll';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { AnimatedRing } from '@/components/ui/animated-ring';
import { ApiErrorAlert } from '@/components/admin/api-error-alert';
import { StatCard } from '@/components/dashboard/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { CARD, CARD_PAD, TEXT_LABEL, TEXT_SECTION } from './instructor-ui';
import { LowSampleTag } from './overview-parts';
import { CourseTrendChart } from './course-trend-chart';

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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <div className="col-span-2">
            <StatCard
              icon={Star}
              tone="primary"
              interactive={false}
              label="GPA ของวิชา"
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
              footer={
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {values ? (
                    <>
                      <span>≈ เกรด {gradeText(values.nearest)} (จาก 4.00)</span>
                      {center.level === 'low' && <LowSampleTag counted={center.people} />}
                    </>
                  ) : (
                    <span>{formatGradeTally(stats.counts)}</span>
                  )}
                </div>
              }
            />
          </div>
          <CountCard
            icon={Users}
            tone="neutral"
            label="นิสิตที่มีเกรด"
            count={stats.seats}
            note="ทุกเกรดที่บันทึกไว้"
          />
          <CountCard
            icon={TrendingUp}
            tone="success"
            label="ได้ B ขึ้นไป"
            count={stats.achieved}
            total={stats.seats}
          />
          <CountCard
            icon={XCircle}
            tone={stats.f > 0 ? 'danger' : 'neutral'}
            label="ได้ F"
            count={stats.f}
            total={stats.seats}
          />
          <CountCard
            icon={MinusCircle}
            tone={stats.w > 0 ? 'warning' : 'neutral'}
            label="ถอน (W)"
            count={stats.w}
            total={stats.seats}
          />
        </div>

        {values && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4 border-t pt-5">
            {showAchievementRing(stats.graded, stats.achievedPercent) && (
              <AnimatedRing percent={stats.achievedPercent} size={112} strokeWidth={10}>
                <span className="text-center leading-tight">
                  <span className="block text-2xl font-bold tabular-nums text-primary">
                    <AnimatedNumber
                      value={Math.round(stats.achievedPercent)}
                      format={(n) => `${n}%`}
                    />
                  </span>
                  <span className="block text-xs font-medium text-muted-foreground">B ขึ้นไป</span>
                </span>
              </AnimatedRing>
            )}
            <div className="min-w-0 flex-1 basis-64">
              <p className="text-base font-medium text-primary">{summaryLine(snapshot)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                ดูเกรดกลางและการกระจายของเกรดได้ในการ์ด &ldquo;การกระจายเกรด&rdquo; ด้านล่าง
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// One count with its share of everyone who has a grade in the course.
function CountCard({
  icon,
  tone,
  label,
  count,
  total,
  note,
}: Readonly<{
  icon: typeof Users;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
  label: string;
  count: number;
  total?: number;
  note?: string;
}>) {
  return (
    <StatCard
      icon={icon}
      tone={tone}
      interactive={false}
      label={label}
      value={<AnimatedNumber value={count} />}
      suffix="คน"
      footer={
        <p className="text-sm text-muted-foreground">
          {total !== undefined && total > 0
            ? `${formatPercent((count / total) * 100)} ของทั้งหมด`
            : note}
        </p>
      }
    />
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
                <th className="px-5 py-2.5 text-right font-medium">ได้ B ขึ้นไป (%)</th>
                <th className="px-5 py-2.5 text-right font-medium">เกรดเฉลี่ย</th>
                <th className="px-5 py-2.5 text-right font-medium">เกรดกลาง</th>
              </tr>
            </thead>
            <tbody>
              {years.rows.map((row) => (
                <tr key={row.yearLevel} className="interactive-row border-b last:border-0">
                  <td className="px-5 py-3.5 text-base font-bold text-primary">
                    {yearLevelLabel(row.yearLevel)}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums">{row.stats.seats}</td>
                  <td className="px-5 py-3.5">
                    <div className="ml-auto w-32 space-y-1.5">
                      <p className="text-right text-lg font-semibold tabular-nums text-primary">
                        {row.showNumbers ? formatPercent(row.stats.achievedPercent) : '—'}
                      </p>
                      {row.showNumbers && (
                        <Progress
                          value={row.stats.achievedPercent ?? 0}
                          label={`ได้ B ขึ้นไป ${formatPercent(row.stats.achievedPercent)}`}
                          barClassName="bg-brand"
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums">
                    {row.showNumbers ? formatGpa(row.stats.gpa) : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
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
        <EmptyState
          icon={Target}
          className="py-4"
          description="ยังไม่มีเป้าการเรียนรู้ที่กำหนดไว้ในวิชานี้ เมื่อผู้ดูแลระบบกำหนดแล้ว จะแสดงที่นี่"
        />
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

// The middle of the grade spread, from the same figures that sat in the
// collapsed block on the summary: the bars already show the highest, the lowest
// and the most common grade, so only what they do not show is written out.
function GradeCenterFigures({ snapshot }: Readonly<{ snapshot: CourseSnapshot }>) {
  const values = summarizeGradeCenter(snapshot.stats.counts).values;
  if (!values) return null;
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-3 border-t pt-3 sm:grid-cols-3">
      <Figure small label="เกรดกลาง" value={formatMedian(values.median)} />
      <Figure small label="เกรดที่พบมากที่สุด" value={formatGradeList(values.modes)} />
      <Figure
        small
        label="ส่วนเบี่ยงเบนมาตรฐานของแต้มเกรด"
        value={values.stdDev.toFixed(2)}
        note="ยิ่งมาก เกรดยิ่งกระจายห่างกัน"
      />
    </dl>
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
              <Progress
                value={s.count === 0 ? 0 : Math.max(2, s.percent)}
                label={`${GRADE_LABELS[s.grade]} ${s.count} คน ${oneDecimal(s.percent)}`}
                className="h-3 min-w-0 flex-1"
                barClassName={gradeBarClassName(s.grade)}
              />
              <span className="w-28 shrink-0 text-right text-sm tabular-nums">
                <span className="font-semibold text-primary">{s.count}</span>{' '}
                <span className="text-muted-foreground">คน · {oneDecimal(s.percent)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <GradeCenterFigures snapshot={snapshot} />
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
  const change = trend.enough ? trend.change : null;
  return (
    <SectionCard
      title="แนวโน้มรายภาคเรียน"
      description={
        change
          ? `ร้อยละของนิสิตที่ได้ B ขึ้นไป${
              change.points === 0
                ? 'ใกล้เคียงเดิม'
                : ` ${change.points > 0 ? 'เพิ่มขึ้น' : 'ลดลง'} ${Math.abs(change.points)} จุด`
            } เมื่อเทียบกับ${change.fromLabel}`
          : 'ร้อยละของนิสิตที่ได้ B ขึ้นไป ในแต่ละภาคเรียน'
      }
    >
      {trend.enough ? (
        <CourseTrendChart terms={trend.terms} />
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          {SPARSE_TREND} (มี {trend.termCount} ภาคเรียน ต้องมีอย่างน้อย {MIN_TERMS_FOR_TREND}{' '}
          ภาคเรียน)
        </p>
      )}
    </SectionCard>
  );
}
