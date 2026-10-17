import { type ReactNode } from 'react';
import { BarChart3 } from 'lucide-react';
import { dataLevelOf, type CourseSnapshot } from '@/lib/course-snapshot';
import { formatGradeList, formatMedian, summarizeGradeCenter } from '@/lib/grade-center';
import { GRADE_LABELS } from '@/lib/grade-label';
import { gradeBarClassName } from '@/lib/grade-badge-color';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { SectionCard } from '@/components/ui/section-card';

const oneDecimal = (n: number) => `${n.toFixed(1)}%`;

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

export function GradesSection({ snapshot }: Readonly<{ snapshot: CourseSnapshot }>) {
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
