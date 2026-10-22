import type { ReactNode } from 'react';
import type { TrendChange } from '@/lib/course-snapshot';
import { fewStudentsLabel } from '@/lib/course-snapshot';
import { formatPercent } from '@/lib/format-percent';
import { INSUFFICIENT_BELOW } from '@/lib/instructor-overview';
import type { Portfolio } from '@/lib/instructor-portfolio';
import { CARD } from './instructor-ui';
import { cn } from '@/lib/utils';

// Four figures, the second one on the brand's navy so the share at B or above
// leads. Plain divs rather than StatCard: this look has no icon tile and a larger
// figure.
function Stat({
  label,
  emphasis = false,
  children,
  note,
}: Readonly<{ label: string; emphasis?: boolean; children: ReactNode; note: ReactNode }>) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-2xl px-5 py-5 sm:px-6',
        emphasis ? 'bg-primary text-primary-foreground shadow-lg' : CARD,
      )}
    >
      <p
        className={cn('text-sm', emphasis ? 'text-primary-foreground/80' : 'text-muted-foreground')}
      >
        {label}
      </p>
      <p className="text-[2.5rem] font-bold leading-[1.1] tabular-nums">{children}</p>
      <div
        className={cn(
          'text-[13px] leading-snug',
          emphasis ? 'text-amber-300' : 'text-muted-foreground',
        )}
      >
        {note}
      </div>
    </div>
  );
}

const Unit = ({ children }: Readonly<{ children: ReactNode }>) => (
  <span className="ml-1.5 text-base font-medium text-muted-foreground">{children}</span>
);

function changeText({ points }: TrendChange): string {
  if (points === 0) return 'เท่ากับภาคก่อน';
  return `${points > 0 ? 'เพิ่มขึ้น' : 'ลดลง'} ${Math.abs(points)} จุดเปอร์เซ็นต์จากภาคก่อน`;
}

export function PortfolioStats({
  portfolio,
  lowGradePeople,
  lowGradeRows,
  change,
  atBar,
}: Readonly<{
  portfolio: Portfolio;
  lowGradePeople: number;
  // One per student and course; more than the people when one student is low in two courses.
  lowGradeRows: number;
  change: TrendChange | null;
  atBar: { met: number; judged: number };
}>) {
  const { graded, percent, target, status, courseCount, barsDiffer } = portfolio;
  const verdict =
    target === null || status === 'few' || status === 'none'
      ? null
      : `${status === 'met' ? 'ถึงเกณฑ์' : 'ต่ำกว่าเกณฑ์'} ${barsDiffer ? 'เฉลี่ย ' : ''}${formatPercent(target)}`;
  const share = graded > 0 ? (lowGradeRows / graded) * 100 : null;

  return (
    <section aria-label="ตัวเลขสำคัญ" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="นิสิตที่มีเกรด" note={`จาก ${courseCount} วิชา (นับรายวิชาละครั้ง)`}>
        {graded}
        <Unit>คน</Unit>
      </Stat>

      <Stat
        emphasis
        label="ได้ B ขึ้นไป"
        note={
          percent === null ? (
            'ยังไม่มีเกรด A ถึง F'
          ) : status === 'few' ? (
            `${fewStudentsLabel(graded)} — ยังไม่ตัดสินเทียบเกณฑ์`
          ) : (
            <>
              {verdict}
              {change && ` · ${changeText(change)}`}
            </>
          )
        }
      >
        {percent === null ? '—' : Math.round(percent)}
        {percent !== null && <span className="ml-0.5 text-[1.375rem] font-semibold">%</span>}
      </Stat>

      <Stat
        label="ควรติดตาม (D+ ลงไป)"
        note={
          lowGradeRows === 0
            ? 'ยังไม่มีนิสิตที่มีเกรด D+ ลงไป'
            : lowGradeRows === lowGradePeople && share !== null
              ? `คิดเป็น ${share.toFixed(1)}% ของนิสิตที่มีเกรด`
              : `${lowGradeRows} รายการ (บางคนมี D+ ลงไปหลายวิชา)`
        }
      >
        <span className={lowGradePeople > 0 ? 'text-amber-700' : undefined}>{lowGradePeople}</span>
        <Unit>คน</Unit>
      </Stat>

      {/* No credits reach the instructor dashboard, so a credit-weighted GPA cannot
          be given; the number of courses at their bar says the same kind of thing. */}
      <Stat
        label="วิชาที่ถึงเกณฑ์"
        note={
          atBar.judged === 0
            ? `ต้องมีนิสิตที่ได้เกรดอย่างน้อย ${INSUFFICIENT_BELOW} คนจึงตัดสินได้`
            : `จาก ${atBar.judged} วิชาที่ตัดสินได้ (เทียบเกณฑ์ของแต่ละวิชา)`
        }
      >
        {atBar.judged === 0 ? '—' : atBar.met}
        {atBar.judged > 0 && <Unit>/ {atBar.judged}</Unit>}
      </Stat>
    </section>
  );
}
