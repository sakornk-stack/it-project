'use client';

import { useId, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  GraduationCap,
  MinusCircle,
  Star,
  Target,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import type { InstructorCourseSummary } from '@eduanalyze-ai/shared-types';
import {
  fetchInstructorCourseTimeline,
  fetchInstructorStudents,
  fetchInstructorYearLevels,
} from '@/lib/api/instructor';
import {
  EMPTY_SNAPSHOT,
  SPARSE_YEAR_NOTE,
  buildCourseSnapshot,
  courseTermInfo,
  dataLevelOf,
  type CourseSnapshot,
  type GoalItem,
  type TrendTerm,
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
import { GRADE_LABELS } from '@/lib/grade-label';
import { gradeBarClassName } from '@/lib/grade-badge-color';
import { formatGpa } from '@/lib/instructor-overview';
import { cn } from '@/lib/utils';
import { PageSection } from '@/components/layout/page-section';
import { RevealOnScroll } from '@/components/layout/reveal-on-scroll';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { ApiErrorAlert } from '@/components/admin/api-error-alert';
import { StatCard } from '@/components/dashboard/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { CARD, CARD_PAD } from './instructor-ui';
import { SectionCard } from './section-card';
import { LowSampleTag } from './overview-parts';
import { CourseTrendChart, sparseTermText } from './course-trend-chart';

const oneDecimal = (n: number) => `${n.toFixed(1)}%`;

// One course, read the same way on the dashboard and on the course page. The
// numbers all come from buildCourseSnapshot, so the two pages cannot differ.
// Which course it is (name, term, actions) is the CourseHero's job. From xl up
// the sections split in two columns: the grade reading on the left (distribution,
// trend, year levels), the course's own context on the right (goals, then `aside`).
export function CourseOverview({
  course,
  aside,
}: Readonly<{ course: InstructorCourseSummary; aside?: ReactNode }>) {
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

  if (snapshot.empty) {
    return (
      <div className="space-y-6">
        <section className={`${CARD} ${CARD_PAD}`}>
          <p className="text-sm text-muted-foreground">{EMPTY_SNAPSHOT}</p>
        </section>
        {aside && <div className="space-y-6">{aside}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <RevealOnScroll>
            <GradesSection snapshot={snapshot} />
          </RevealOnScroll>
          <RevealOnScroll>
            <TrendSection snapshot={snapshot} />
          </RevealOnScroll>
          <RevealOnScroll>
            <YearSection snapshot={snapshot} loading={yearsLoading} />
          </RevealOnScroll>
        </div>
        {/* Sticky so the shorter side stays in view while the long side scrolls; the
            max height keeps a tall aside reachable (it scrolls inside) instead of cut off. */}
        <div className="-m-1 min-w-0 space-y-6 p-1 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:self-start xl:overflow-y-auto xl:overscroll-contain">
          <RevealOnScroll>
            <GoalsSection snapshot={snapshot} />
          </RevealOnScroll>
          {aside}
        </div>
      </div>
    </div>
  );
}

// The headline numbers sit straight on the page (no card around them): each
// StatCard is its own card, so the row is one level.
function SummarySection({
  snapshot,
  termLabel,
}: Readonly<{ snapshot: CourseSnapshot; termLabel?: string }>) {
  const { stats } = snapshot;
  const center = useMemo(() => summarizeGradeCenter(stats.counts), [stats.counts]);
  const values = center.values;
  return (
    <PageSection
      title="สรุปผล"
      description={termLabel ? `รอบล่าสุด ${termLabel}` : undefined}
    >
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
    </PageSection>
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

// One cell of the strip under the distribution: a muted label over a figure.
function Figure({
  label,
  value,
  note,
}: Readonly<{ label: string; value: ReactNode; note?: string }>) {
  return (
    <div className="min-w-0 px-3 py-3 sm:px-4" title={note}>
      <dt className="break-words text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-lg font-semibold tabular-nums text-primary">{value}</dd>
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
  const hasRows = !loading && !!years && years.rows.length > 0;
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
        <div className="hidden overflow-x-auto border-t md:block">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs text-muted-foreground">
                <th scope="col" className="px-6 py-2.5 font-medium">
                  ชั้นปี
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  มีเกรด (คน)
                </th>
                <th scope="col" className="w-56 px-4 py-2.5 text-left font-medium">
                  ได้ B ขึ้นไป (%)
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  เกรดเฉลี่ย
                </th>
                <th scope="col" className="px-6 py-2.5 text-right font-medium">
                  เกรดกลาง
                </th>
              </tr>
            </thead>
            <tbody>
              {years.rows.map((row) => (
                <tr key={row.yearLevel} className="interactive-row border-b last:border-0">
                  <th scope="row" className="px-6 py-3.5 text-left text-base font-bold text-primary">
                    {yearLevelLabel(row.yearLevel)}
                  </th>
                  <td className="px-4 py-3.5 text-right tabular-nums">{row.stats.seats}</td>
                  <td className="px-4 py-3.5">
                    <AchievedCell row={row} />
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums">
                    {row.showNumbers ? formatGpa(row.stats.gpa) : '—'}
                  </td>
                  <td className="px-6 py-3.5 text-right">
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
        <ul className="grid gap-3 px-4 pb-4 sm:grid-cols-2 md:hidden">
          {years.rows.map((row) => (
            <YearListItem key={row.yearLevel} row={row} />
          ))}
        </ul>
      </>
    );
  }
  return (
    <SectionCard
      icon={GraduationCap}
      title="ภาพรวมตามชั้นปี"
      description="ชั้นปีของนิสิตเทียบกับปีการศึกษาล่าสุด แสดงเฉพาะชั้นปีที่มีนิสิตในวิชานี้"
      footer={footer}
      flush
    >
      {/* The table runs edge to edge under the header; everything else keeps the card padding. */}
      {hasRows ? body : <div className="px-4 pb-4 sm:px-6 sm:pb-6">{body}</div>}
    </SectionCard>
  );
}

// The share at B or above: the figure and the bar share one left edge and the
// bar takes the whole cell, so rows compare at a glance.
function AchievedCell({ row }: Readonly<{ row: YearRow }>) {
  return (
    <div className="space-y-1.5">
      <p className="text-lg font-semibold tabular-nums text-primary">
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
  );
}

// The middle grade of one year level; null while there are too few people.
function medianOf(row: YearRow): string | null {
  const values = summarizeGradeCenter(row.stats.counts).values;
  return values && row.showNumbers ? formatMedian(values.median) : null;
}

// Phones and small tablets: one small card per year level, same figures as a table row.
function YearListItem({ row }: Readonly<{ row: YearRow }>) {
  const median = medianOf(row);
  return (
    <li className="space-y-3 rounded-lg border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-bold text-primary">{yearLevelLabel(row.yearLevel)}</p>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span className="text-sm tabular-nums text-muted-foreground">
            มีเกรด {row.stats.seats} คน
          </span>
          {row.level === 'low' && <LowSampleTag counted={row.stats.graded} />}
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs text-muted-foreground">ได้ B ขึ้นไป</p>
        <AchievedCell row={row} />
      </div>
      <dl className="grid grid-cols-2 gap-3 border-t pt-3">
        <div>
          <dt className="text-xs text-muted-foreground">เกรดเฉลี่ย</dt>
          <dd className="font-semibold tabular-nums text-primary">
            {row.showNumbers ? formatGpa(row.stats.gpa) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">เกรดกลาง</dt>
          <dd className="font-semibold tabular-nums text-primary">{median ?? '—'}</dd>
        </div>
      </dl>
    </li>
  );
}

// A code chip (mono) in a fixed narrow column, and the goal's words clamped to two
// lines so every row has the same height.
function GoalRow({ goal }: Readonly<{ goal: GoalItem }>) {
  return (
    <li className="flex min-h-16 items-center gap-3 py-3">
      <Badge tone="neutral" className="w-14 justify-center font-mono">
        {goal.code}
      </Badge>
      <p className="line-clamp-2 min-w-0 flex-1 break-words text-sm text-primary" title={goal.description}>
        {goal.description}
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
      icon={Target}
      title="เป้าการเรียนรู้"
      description="สิ่งที่นิสิตควรทำได้เมื่อเรียนจบวิชา"
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

// The middle of the grade spread: the bars already show the highest, the lowest
// and the most common grade, so only what they do not show is written out, as
// one strip of three equal cells.
function GradeCenterFigures({ snapshot }: Readonly<{ snapshot: CourseSnapshot }>) {
  const values = summarizeGradeCenter(snapshot.stats.counts).values;
  if (!values) return null;
  return (
    <dl className="grid grid-cols-3 divide-x overflow-hidden rounded-lg border bg-slate-50">
      <Figure label="เกรดกลาง" value={formatMedian(values.median)} />
      <Figure label="เกรดที่พบมากที่สุด" value={formatGradeList(values.modes)} />
      <Figure
        label="ส่วนเบี่ยงเบนมาตรฐาน"
        value={values.stdDev.toFixed(2)}
        note="ส่วนเบี่ยงเบนมาตรฐานของแต้มเกรด: ยิ่งมาก เกรดยิ่งกระจายห่างกัน"
      />
    </dl>
  );
}

function GradesSection({ snapshot }: Readonly<{ snapshot: CourseSnapshot }>) {
  const { grades } = snapshot;
  if (grades.scored === 0) {
    return (
      <SectionCard icon={BarChart3} title="การกระจายเกรด">
        <p className="text-sm text-muted-foreground">ยังไม่มีเกรด A ถึง F</p>
      </SectionCard>
    );
  }
  // Under 5 people a bar shows nothing a count does not: chips, no chart.
  const fewPeople = dataLevelOf(grades.scored) === 'insufficient';
  return (
    <SectionCard
      icon={BarChart3}
      title="การกระจายเกรด"
      description="เกรดล่าสุดของนิสิตแต่ละคนในวิชานี้ (A ถึง F) พร้อมเกรดกลางและส่วนเบี่ยงเบนของวิชา"
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
      <p className="text-sm text-muted-foreground">
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

// Fewer than two terms with enough people: no chart, only the latest usable
// figure and a compact list of every term.
function TrendSummary({ terms }: Readonly<{ terms: TrendTerm[] }>) {
  const usable = terms.filter((t) => t.showNumbers);
  const latest = usable[usable.length - 1];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <p className="text-4xl font-bold leading-none tabular-nums text-primary">
          {latest ? formatPercent(latest.percent) : '—'}
        </p>
        <div className="min-w-0 flex-1 basis-56 space-y-1">
          <p className="text-sm font-medium text-primary">
            ยังเห็นแนวโน้มไม่ได้ เพราะมีเพียง {usable.length} ภาคเรียนที่มีข้อมูลเพียงพอ
          </p>
          {latest && (
            <p className="text-xs text-muted-foreground">
              {latest.label} · ได้ B ขึ้นไป · มีเกรด{' '}
              <span className="tabular-nums">{latest.students}</span> คน
            </p>
          )}
        </div>
      </div>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
        {terms.map((t) => (
          <li key={t.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
            <span className="min-w-0 break-words text-primary">{t.label}</span>
            <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 tabular-nums">
              {t.showNumbers ? (
                <>
                  <span className="text-muted-foreground">{t.students} คน</span>
                  <span className="font-semibold text-primary">
                    ได้ B ขึ้นไป {formatPercent(t.percent)}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">{sparseTermText(t.students)}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrendSection({ snapshot }: Readonly<{ snapshot: CourseSnapshot }>) {
  const { trend } = snapshot;
  // A line needs two terms with enough people; fewer gives a figure and a list.
  const drawChart = trend.terms.filter((t) => t.showNumbers).length >= 2;
  const change = drawChart ? trend.change : null;
  let body: ReactNode;
  if (drawChart) body = <CourseTrendChart terms={trend.terms} />;
  else if (trend.termCount >= 1) body = <TrendSummary terms={trend.terms} />;
  else {
    body = (
      <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
        ยังไม่มีข้อมูลรายภาคเรียน
      </p>
    );
  }
  return (
    <SectionCard
      icon={TrendingUp}
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
      {body}
    </SectionCard>
  );
}
