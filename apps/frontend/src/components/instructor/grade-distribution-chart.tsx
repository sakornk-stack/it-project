import { BarChart3 } from 'lucide-react';
import type { Grade } from '@eduanalyze-ai/shared-types';
import { dataLevelOf } from '@/lib/course-snapshot';
import { GRADE_LABELS } from '@/lib/grade-label';
import { formatPercent } from '@/lib/format-percent';
import type { Portfolio } from '@/lib/instructor-portfolio';
import { SectionCard } from '@/components/ui/section-card';

// Green for the top grades to amber for the low ones; F is the deepest amber, not
// red (under the bar is a to-do, the colour rule of the instructor pages).
const FILL: Record<Grade, string> = {
  A: 'fill-emerald-600',
  B_PLUS: 'fill-emerald-500',
  B: 'fill-emerald-400',
  C_PLUS: 'fill-amber-300',
  C: 'fill-amber-400',
  D_PLUS: 'fill-amber-500',
  D: 'fill-amber-600',
  F: 'fill-amber-700',
  W: 'fill-slate-300',
  I: 'fill-slate-300',
  S: 'fill-slate-300',
  U: 'fill-slate-300',
};

const W = 400;
const SLOT = 47;
const BAR = 34;
const BASE = 190;
const TOP_ROOM = 150;

// Latest grade of every student, summed over the instructor's courses, A to F, as
// bars with the head count on each. Plain SVG: the figures are in the picture and
// in its aria-label, so nothing rests on colour.
export function GradeDistributionChart({ portfolio }: Readonly<{ portfolio: Portfolio }>) {
  const { bars, graded, achieved, percent } = portfolio;
  const label = `การกระจายเกรด: ${bars
    .map((b) => `${GRADE_LABELS[b.grade]} ${b.count} คน`)
    .join(', ')}`;
  const max = Math.max(1, ...bars.map((b) => b.count));
  const fewPeople = dataLevelOf(graded) === 'insufficient';

  return (
    <SectionCard
      icon={BarChart3}
      title="การกระจายเกรด"
      description={
        graded > 0
          ? `เกรดล่าสุดของนิสิตแต่ละคน รวมทุกวิชาที่สอน (A ถึง F รวม ${graded} คน)`
          : 'เกรดล่าสุดของนิสิตแต่ละคน รวมทุกวิชาที่สอน'
      }
      className="min-w-0"
    >
      {graded === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีเกรด A ถึง F</p>
      ) : fewPeople ? (
        <ul className="flex flex-wrap gap-2">
          {bars
            .filter((b) => b.count > 0)
            .map((b) => (
              <li
                key={b.grade}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 px-3 text-sm"
              >
                <span className="font-semibold text-primary">{GRADE_LABELS[b.grade]}</span>
                <span className="tabular-nums text-muted-foreground">{b.count} คน</span>
              </li>
            ))}
        </ul>
      ) : (
        <svg
          viewBox={`0 0 ${W} 250`}
          role="img"
          aria-label={`${label}. ได้ B ขึ้นไป ${achieved} คน (${formatPercent(percent)})`}
          className="block h-auto w-full"
        >
          <line x1="10" x2={W - 10} y1={BASE} y2={BASE} className="stroke-slate-300" />
          <line
            x1="10"
            x2={W - 10}
            y1={BASE - TOP_ROOM / 2}
            y2={BASE - TOP_ROOM / 2}
            className="stroke-slate-100"
          />
          {bars.map((b, i) => {
            const x = 12 + i * SLOT + (SLOT - BAR) / 2;
            const h = b.count === 0 ? 2 : Math.max(4, (b.count / max) * TOP_ROOM);
            const cx = x + BAR / 2;
            return (
              <g key={b.grade}>
                <rect x={x} y={BASE - h} width={BAR} height={h} rx={5} className={FILL[b.grade]} />
                <text
                  x={cx}
                  y={BASE - h - 7}
                  textAnchor="middle"
                  className="fill-primary text-[13px] font-semibold"
                >
                  {b.count}
                </text>
                <text
                  x={cx}
                  y={BASE + 22}
                  textAnchor="middle"
                  className="fill-slate-700 text-[13px]"
                >
                  {GRADE_LABELS[b.grade]}
                </text>
              </g>
            );
          })}
          <path
            d={`M ${12 + (SLOT - BAR) / 2} 232 H ${12 + 2 * SLOT + (SLOT + BAR) / 2}`}
            className="stroke-emerald-600"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <text
            x={12 + (3 * SLOT) / 2}
            y="248"
            textAnchor="middle"
            className="fill-slate-700 text-[12px]"
          >
            {`B ขึ้นไป ${achieved} คน (${Math.round(percent ?? 0)}%)`}
          </text>
        </svg>
      )}
      {graded > 0 && !fewPeople && (
        <p className="sr-only">
          ได้ B ขึ้นไป {achieved} คน จาก {graded} คน
        </p>
      )}
    </SectionCard>
  );
}
