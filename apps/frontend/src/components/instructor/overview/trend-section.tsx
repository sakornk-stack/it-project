import { type ReactNode } from 'react';
import { TrendingUp } from 'lucide-react';
import { type CourseSnapshot, type TrendTerm } from '@/lib/course-snapshot';
import { formatPercent } from '@/lib/format-percent';
import { SectionCard } from '../section-card';
import { CourseTrendChart, sparseTermText } from '../course-trend-chart';

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
          <li
            key={t.key}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2"
          >
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

export function TrendSection({ snapshot }: Readonly<{ snapshot: CourseSnapshot }>) {
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
