import { Grid3x3 } from 'lucide-react';
import type { CoursePloEntry } from '@eduanalyze-ai/shared-types';
import {
  CLO_PLO_CHART_NOTE,
  NO_CLO_PLO_LINK_LABEL,
  buildCloPloMatrix,
  describeTopPlos,
} from '@/lib/plo-clo-chart';
import { cn } from '@/lib/utils';
import { SectionCard } from '@/components/ui/section-card';

const WEIGHTS = [1, 2, 3, 4, 5] as const;

// Darker = heavier. The number stays in the cell, so colour is never the only cue.
function cellStyle(weight: number): { backgroundColor: string; color: string } {
  return {
    backgroundColor: `hsl(var(--brand) / ${(0.16 + weight * 0.14).toFixed(2)})`,
    color: weight >= 4 ? 'hsl(var(--brand-foreground))' : 'hsl(var(--primary))',
  };
}

const CELL = 'h-11 min-w-14 border border-border px-2 text-center tabular-nums';

// CLO x PLO of one course: which PLO each CLO feeds and how strongly (1 to 5).
export function CloPloHeatmap({
  clos,
  plos,
}: Readonly<{
  clos: readonly { cloId: string; code: string }[];
  plos: readonly CoursePloEntry[];
}>) {
  const matrix = buildCloPloMatrix(clos, plos);
  const top = describeTopPlos(matrix);

  return (
    <SectionCard
      icon={Grid3x3}
      title="CLO ช่วย PLO ข้อไหน"
      description="ตัวเลขในช่องคือน้ำหนัก 1–5 ที่ CLO ข้อนั้นมีต่อ PLO (มาก = มีผลมาก)"
    >
      {matrix.isEmpty ? (
        <p className="text-sm text-muted-foreground">{NO_CLO_PLO_LINK_LABEL}</p>
      ) : (
        <>
          {top && <p className="text-sm font-medium text-primary">{top}</p>}

          {/* Only this box scrolls on a narrow screen, never the page. */}
          <div className="relative max-w-full overflow-x-auto rounded-lg border border-border">
            <table
              className="w-full border-collapse text-sm"
              aria-label="น้ำหนักการเชื่อมระหว่าง CLO แต่ละข้อกับ PLO"
            >
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-10 h-11 min-w-16 border border-border bg-card px-2 text-left text-xs font-medium text-muted-foreground"
                  >
                    CLO
                  </th>
                  {matrix.plos.map((p) => (
                    <th
                      key={p.ploId}
                      scope="col"
                      title={p.name}
                      className="h-11 min-w-14 border border-border bg-card px-2 text-center text-xs font-semibold text-primary"
                    >
                      {p.code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.clos.map((row) => (
                  <tr key={row.cloId}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 h-11 border border-border bg-card px-2 text-left font-mono text-xs font-semibold text-primary"
                    >
                      {row.code}
                    </th>
                    {row.cells.map((weight, i) => (
                      <td
                        key={matrix.plos[i].ploId}
                        className={cn(CELL, weight === null && 'bg-muted/40 text-muted-foreground')}
                        style={weight === null ? undefined : cellStyle(weight)}
                      >
                        {weight === null ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="sr-only">
                              {row.code} ไม่เชื่อมกับ {matrix.plos[i].code}
                            </span>
                          </>
                        ) : (
                          <>
                            <span aria-hidden="true" className="font-semibold">
                              {weight}
                            </span>
                            <span className="sr-only">
                              {row.code} เชื่อมกับ {matrix.plos[i].code} น้ำหนัก {weight}
                            </span>
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span>น้ำหนัก</span>
            <ul className="flex items-center gap-1" aria-label="คำอธิบายสี">
              {WEIGHTS.map((w) => (
                <li
                  key={w}
                  className="flex h-6 w-6 items-center justify-center rounded border border-border text-xs font-semibold tabular-nums"
                  style={cellStyle(w)}
                >
                  {w}
                </li>
              ))}
            </ul>
            <span>น้อย → มาก</span>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-flex h-6 w-6 items-center justify-center rounded border border-border bg-muted/40"
              >
                ·
              </span>
              ไม่เชื่อม
            </span>
          </div>

          {matrix.unlinkedCloCodes.length > 0 && (
            <p className="text-xs text-muted-foreground">
              CLO ที่ยังไม่เชื่อมกับ PLO ใด: {matrix.unlinkedCloCodes.join(', ')}
            </p>
          )}
        </>
      )}
      <p className="text-xs text-muted-foreground">{CLO_PLO_CHART_NOTE}</p>
    </SectionCard>
  );
}
