import type { PloStack } from '@/lib/plo-clo-chart';
import { CLO_PLO_CHART_NOTE, NO_CLO_PLO_LINK_LABEL } from '@/lib/plo-clo-chart';

const swatch = (i: number) => `hsl(var(--chart-${i + 1}))`;
const swatchText = (i: number) => `hsl(var(--chart-${i + 1}-fg))`;

// One horizontal bar per PLO, split by the courses that feed it (sum of the
// weights of the course's CLOs mapped to it). Bar length = total weight, never a
// result. Segments carry their weight as a number; the table-like list below
// each bar's aria-label gives the same facts to a screen reader.
export function PloStackChart({ stack }: Readonly<{ stack: PloStack }>) {
  if (stack.isEmpty) {
    return <p className="text-sm text-muted-foreground">{NO_CLO_PLO_LINK_LABEL}</p>;
  }
  const single = stack.legend.length === 1;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{CLO_PLO_CHART_NOTE}</p>
      <ul className="space-y-2" aria-label="น้ำหนักรวมของวิชาที่ช่วยแต่ละ PLO">
        {stack.rows.map((row) => {
          const label =
            row.segments.length === 0
              ? `${row.code} ยังไม่มีวิชาของคุณเชื่อม`
              : `${row.code} น้ำหนักรวม ${row.total}: ${row.segments
                  .map((s) => `${s.courseCode} ${s.weight}`)
                  .join(', ')}`;
          return (
            <li key={row.ploId} className="flex items-center gap-3">
              <span
                title={row.name}
                className="w-16 shrink-0 text-xs font-semibold text-primary sm:w-20"
              >
                {row.code}
              </span>
              <div role="img" aria-label={label} className="min-w-0 flex-1">
                {row.segments.length === 0 ? (
                  <span className="text-xs text-muted-foreground">ยังไม่มีวิชาของคุณเชื่อม</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-7 gap-px overflow-hidden rounded-md"
                      style={{
                        width: `${(row.total / stack.maxTotal) * 100}%`,
                        minWidth: '1.75rem',
                      }}
                    >
                      {row.segments.map((s) => (
                        <div
                          key={s.courseId}
                          title={`${s.courseCode} ${s.courseName} — น้ำหนักรวม ${s.weight}`}
                          className="flex min-w-0 items-center justify-center text-xs font-semibold tabular-nums"
                          style={{
                            flexGrow: s.weight,
                            flexBasis: 0,
                            backgroundColor: swatch(s.colorIndex),
                            color: swatchText(s.colorIndex),
                          }}
                        >
                          {s.weight}
                        </div>
                      ))}
                    </div>
                    {!single && (
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        รวม {row.total}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <ul
        className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground"
        aria-label="คำอธิบายสี"
      >
        {stack.legend.map((item) => (
          <li key={item.courseId} className="flex min-w-0 items-center gap-1.5" title={item.name}>
            <span
              aria-hidden="true"
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: swatch(item.colorIndex) }}
            />
            <span className="font-mono font-semibold text-primary">{item.code}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
