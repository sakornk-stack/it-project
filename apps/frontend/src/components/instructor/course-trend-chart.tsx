import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { SPARSE_LABEL, formatPointsChange, type TrendTerm } from '@/lib/course-snapshot';
import { formatPercent } from '@/lib/format-percent';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { LowSampleTag } from './overview-parts';

// Width one term gets before the chart scrolls sideways instead of squeezing.
const TERM_MIN_PX = 76;

const columnCentre = (index: number, count: number) => ((index + 0.5) / count) * 100;
const clampPercent = (percent: number) => Math.min(100, Math.max(0, percent));

// "% B or above" per term as a line over a faint area, drawn in plain SVG. The
// stretched SVG only carries the line and the area (non-scaling stroke); the
// dots and numbers are HTML on top, so they stay round and readable at any
// width. A term with too few graded people (showNumbers false) gets no dot, and
// the line crosses it dashed. The latest term is the big dot.
export function CourseTrendChart({ terms }: Readonly<{ terms: TrendTerm[] }>) {
  const count = terms.length;
  const x = (i: number) => columnCentre(i, count) * count; // viewBox is count * 100 wide
  const y = (term: TrendTerm) => 100 - clampPercent(term.percent);
  const visible = terms.map((t, i) => ({ t, i })).filter(({ t }) => t.showNumbers);

  // Runs of neighbouring visible terms: the area is filled under each run only.
  const runs: { t: TrendTerm; i: number }[][] = [];
  for (const point of visible) {
    const run = runs[runs.length - 1];
    if (run && run[run.length - 1].i === point.i - 1) run.push(point);
    else runs.push([point]);
  }
  const segments = visible.slice(1).map((point, k) => ({
    from: visible[k],
    to: point,
    dashed: point.i - visible[k].i > 1,
  }));

  const latest = terms.find((t) => t.isLatest) ?? terms[terms.length - 1];

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <div style={{ minWidth: count * TERM_MIN_PX }}>
          <div aria-hidden="true" className="relative mx-0 mb-1 mt-7 h-40">
            {[0, 50, 100].map((line) => (
              <span
                key={line}
                className="absolute inset-x-0 border-t border-dashed border-slate-200"
                style={{ top: `${100 - line}%` }}
              />
            ))}
            <svg
              viewBox={`0 0 ${count * 100} 100`}
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full overflow-visible text-brand"
              focusable="false"
            >
              {runs
                .filter((run) => run.length > 1)
                .map((run) => (
                  <path
                    key={run[0].t.key}
                    d={`M ${x(run[0].i)} ${y(run[0].t)} ${run
                      .slice(1)
                      .map(({ t, i }) => `L ${x(i)} ${y(t)}`)
                      .join(' ')} L ${x(run[run.length - 1].i)} 100 L ${x(run[0].i)} 100 Z`}
                    fill="currentColor"
                    opacity={0.1}
                  />
                ))}
              {segments.map(({ from, to, dashed }) => (
                <line
                  key={`${from.t.key}-${to.t.key}`}
                  x1={x(from.i)}
                  y1={y(from.t)}
                  x2={x(to.i)}
                  y2={y(to.t)}
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeDasharray={dashed ? '3 6' : undefined}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
            {terms.map((term, i) =>
              term.showNumbers ? (
                <span
                  key={term.key}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${columnCentre(i, count)}%`, top: `${y(term)}%` }}
                >
                  <span
                    className={cn(
                      'block rounded-full border-2 border-brand',
                      term.isLatest
                        ? 'h-4 w-4 bg-brand ring-4 ring-brand-light'
                        : 'h-2.5 w-2.5 bg-card',
                    )}
                  />
                  <span
                    className={cn(
                      'absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap tabular-nums',
                      term.isLatest
                        ? 'text-sm font-bold text-brand'
                        : 'text-xs text-muted-foreground',
                    )}
                  >
                    {formatPercent(term.percent)}
                  </span>
                </span>
              ) : (
                <span
                  key={term.key}
                  className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap text-[11px] text-muted-foreground"
                  style={{ left: `${columnCentre(i, count)}%` }}
                >
                  ไม่แสดงตัวเลข
                </span>
              ),
            )}
          </div>
          <ul className="flex">
            {terms.map((term) => (
              <li
                key={term.key}
                className="min-w-0 flex-1 space-y-0.5 px-1 text-center"
                style={{ flexBasis: 0 }}
              >
                <p
                  className={cn(
                    'break-words text-xs',
                    term.isLatest ? 'font-semibold text-primary' : 'text-muted-foreground',
                  )}
                >
                  {term.label}
                </p>
                <p className="text-[11px] tabular-nums text-muted-foreground">{term.students} คน</p>
                {term.level === 'low' && <LowSampleTag counted={term.graded} />}
                {!term.showNumbers && (
                  <p className="text-[11px] text-muted-foreground">{SPARSE_LABEL}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ul className="sr-only">
        {terms.map((term) => (
          <li key={term.key}>
            {term.label}:{' '}
            {term.showNumbers ? `ได้ B ขึ้นไป ${formatPercent(term.percent)}` : SPARSE_LABEL} มีเกรด{' '}
            {term.students} คน
          </li>
        ))}
      </ul>

      {latest && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-3 text-sm">
          <span className="text-muted-foreground">
            {latest.label}:{' '}
            {latest.showNumbers ? (
              <>
                <span className="font-semibold tabular-nums text-primary">
                  {formatPercent(latest.percent)}
                </span>{' '}
                ได้ B ขึ้นไป
              </>
            ) : (
              SPARSE_LABEL
            )}{' '}
            · มีเกรด <span className="tabular-nums">{latest.students}</span> คน
          </span>
          <ChangeBadge delta={latest.delta} />
        </div>
      )}
    </div>
  );
}

// Green and up when the share rose, red and down when it fell, grey when flat or
// when either term has too few people to compare. Arrow and words, not colour alone.
function ChangeBadge({ delta }: Readonly<{ delta: number | null }>) {
  if (delta === null) {
    return <Badge tone="neutral">เทียบภาคก่อนไม่ได้ (ข้อมูลยังน้อย)</Badge>;
  }
  if (delta === 0) {
    return (
      <Badge tone="neutral" className="gap-1">
        <Minus size={12} aria-hidden="true" />
        เท่าภาคก่อน
      </Badge>
    );
  }
  const up = delta > 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <Badge tone={up ? 'success' : 'danger'} className="gap-1">
      <Icon size={12} aria-hidden="true" />
      {up ? 'เพิ่มขึ้น' : 'ลดลง'} {Math.abs(delta)} จุด
      <span className="sr-only"> ({formatPointsChange(delta)})</span>
      เทียบภาคก่อน
    </Badge>
  );
}
