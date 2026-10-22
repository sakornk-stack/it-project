import { TrendingUp } from 'lucide-react';
import { INSUFFICIENT_BELOW } from '@/lib/course-snapshot';
import { formatPercent } from '@/lib/format-percent';
import type { Portfolio, PooledTerm } from '@/lib/instructor-portfolio';
import { SectionCard } from '@/components/ui/section-card';

const W = 400;
const H = 230;
const X0 = 44;
// Room right of the plot for the bar's name, so it never sits on a point's figure.
const X1 = W - 62;
const TOP = 26;
const BOTTOM = 176;
const MAX_TERMS = 6;

// Share at B or above per term, pooled over every course, with the bar as a dashed
// line. A term with under 5 graded people is left out (a swing of tens of points
// there is one student). Plain SVG with its figures in the aria-label.
export function PortfolioTrendChart({
  terms,
  portfolio,
}: Readonly<{ terms: PooledTerm[]; portfolio: Portfolio }>) {
  const usable = terms.filter((t) => t.graded >= INSUFFICIENT_BELOW);
  const hidden = terms.length - usable.length;
  const shown = usable.slice(-MAX_TERMS);
  const { target, barsDiffer } = portfolio;

  const description =
    target !== null
      ? `ร้อยละของนิสิตที่ได้ B ขึ้นไป เทียบกับเกณฑ์${barsDiffer ? 'เฉลี่ย' : ''} ${formatPercent(target)}`
      : 'ร้อยละของนิสิตที่ได้ B ขึ้นไป ในแต่ละภาคเรียน';

  let body;
  if (shown.length < 2) {
    const only = shown[0];
    body = (
      <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
        {terms.length === 0
          ? 'ยังไม่มีข้อมูลรายภาคเรียน'
          : `ยังเห็นแนวโน้มไม่ได้ เพราะมี ${shown.length === 0 ? 'ยังไม่มี' : 'เพียง ' + shown.length} ภาคเรียนที่มีนิสิตได้เกรดอย่างน้อย ${INSUFFICIENT_BELOW} คน`}
        {only &&
          ` (${only.label}: ได้ B ขึ้นไป ${formatPercent(only.percent)} จาก ${only.graded} คน)`}
      </p>
    );
  } else {
    const values = shown.map((t) => t.percent);
    const all = target === null ? values : [...values, target];
    const lo = Math.max(0, Math.floor((Math.min(...all) - 8) / 10) * 10);
    const hi = Math.min(100, Math.ceil((Math.max(...all) + 8) / 10) * 10);
    const step = hi - lo > 40 ? 20 : 10;
    const ticks: number[] = [];
    for (let v = lo; v <= hi; v += step) ticks.push(v);
    const y = (v: number) => TOP + ((hi - v) / (hi - lo)) * (BOTTOM - TOP);
    const slot = (X1 - X0) / shown.length;
    const x = (i: number) => X0 + slot * (i + 0.5);
    const label = `แนวโน้มร้อยละที่ได้ B ขึ้นไป: ${shown
      .map((t) => `${t.label} ร้อยละ ${Math.round(t.percent)}`)
      .join(', ')}${target === null ? '' : ` เกณฑ์ร้อยละ ${Math.round(target)}`}`;

    body = (
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block h-auto w-full">
        {ticks.map((v) => (
          <g key={v}>
            <line
              x1={X0}
              x2={X1}
              y1={y(v)}
              y2={y(v)}
              className={v === lo ? 'stroke-slate-300' : 'stroke-slate-100'}
            />
            <text x={X0 - 6} y={y(v) + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
              {v}%
            </text>
          </g>
        ))}
        {target !== null && (
          <g>
            <line
              x1={X0}
              x2={X1}
              y1={y(target)}
              y2={y(target)}
              className="stroke-amber-500"
              strokeWidth="1.5"
              strokeDasharray="6 5"
            />
            <text
              x={X1 + 6}
              y={y(target) + 4}
              textAnchor="start"
              className="fill-amber-700 text-[12px]"
            >
              {`เกณฑ์ ${Math.round(target)}%`}
            </text>
          </g>
        )}
        <polyline
          points={shown.map((t, i) => `${x(i)},${y(t.percent)}`).join(' ')}
          fill="none"
          className="stroke-brand"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {shown.map((t, i) => {
          const isLast = i === shown.length - 1;
          return (
            <g key={t.key}>
              <circle
                cx={x(i)}
                cy={y(t.percent)}
                r={isLast ? 7 : 6}
                strokeWidth={isLast ? 2 : 3}
                className={isLast ? 'fill-brand stroke-card' : 'fill-card stroke-brand'}
              />
              <text
                x={x(i)}
                y={y(t.percent) - 14}
                textAnchor="middle"
                className="fill-primary text-[14px] font-semibold"
              >
                {Math.round(t.percent)}%
              </text>
              {t.label.split(' / ').map((part, k) => (
                <text
                  key={part}
                  x={x(i)}
                  y={BOTTOM + 22 + k * 16}
                  textAnchor="middle"
                  className="fill-slate-700 text-[12px]"
                >
                  {part}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
    );
  }

  return (
    <SectionCard
      icon={TrendingUp}
      title="แนวโน้มรายภาคเรียน"
      description={description}
      className="min-w-0"
    >
      {body}
      {(hidden > 0 || terms.length > MAX_TERMS) && (
        <p className="text-xs text-muted-foreground">
          {hidden > 0 &&
            `ไม่แสดง ${hidden} ภาคเรียนที่มีนิสิตได้เกรดไม่ถึง ${INSUFFICIENT_BELOW} คน. `}
          {usable.length > MAX_TERMS && `แสดง ${MAX_TERMS} ภาคเรียนล่าสุด`}
        </p>
      )}
    </SectionCard>
  );
}
