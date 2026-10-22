import Link from 'next/link';
import { Network } from 'lucide-react';
import {
  CLO_PLO_CHART_NOTE,
  NO_CLO_PLO_LINK_LABEL,
  type CoursePloMatrix,
} from '@/lib/plo-clo-chart';
import { cn } from '@/lib/utils';
import { SectionCard } from '@/components/ui/section-card';

const LEVELS = [1, 2, 3, 4, 5] as const;

// Five steps of the brand colour; the number stays in the cell, so colour is never
// the only cue. The two darkest steps take the light label.
function levelStyle(level: number): { backgroundColor: string; color: string } {
  return {
    backgroundColor: `hsl(var(--brand) / ${(0.12 + level * 0.17).toFixed(2)})`,
    color: level >= 4 ? 'hsl(var(--brand-foreground))' : 'hsl(var(--primary))',
  };
}

const CELL = 'h-11 min-w-14 rounded-lg px-2 text-center tabular-nums';

// Which PLO of the curriculum each course of the instructor feeds, and how strongly:
// the total weight (1 to 5 per CLO) of the course's CLOs mapped to it. Only the
// mapping; a course has one share at B or above, so no result is drawn per PLO.
export function CoursePloHeatmap({ matrix }: Readonly<{ matrix: CoursePloMatrix }>) {
  return (
    <SectionCard
      icon={Network}
      title="วิชาของคุณกับ PLO ของหลักสูตร"
      description="ตัวเลขคือน้ำหนัก 1–5 ที่ CLO ของวิชาเชื่อมกับ PLO (มาก = มีผลต่อ PLO ข้อนั้นมาก) แสดงว่าวิชาช่วย PLO ไหน ไม่ใช่ผลการเรียนของนิสิต"
    >
      {matrix.isEmpty ? (
        <>
          <p className="text-sm text-muted-foreground">{NO_CLO_PLO_LINK_LABEL}</p>
          <p className="text-xs text-muted-foreground">{CLO_PLO_CHART_NOTE}</p>
        </>
      ) : (
        <>
          {/* Only this box scrolls on a narrow screen, never the page. */}
          <div className="relative max-w-full overflow-x-auto">
            <table
              className="border-separate border-spacing-1.5 text-sm"
              aria-label="น้ำหนักการเชื่อมระหว่าง CLO ของแต่ละวิชากับ PLO"
            >
              <thead>
                <tr className="text-[13px] text-slate-700">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 min-w-40 bg-card px-2 py-1 text-left font-semibold"
                  >
                    วิชา
                  </th>
                  {matrix.plos.map((p) => (
                    <th
                      key={p.ploId}
                      scope="col"
                      title={p.name}
                      className="min-w-14 px-2 py-1 text-center font-semibold"
                    >
                      {p.code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((row) => (
                  <tr key={row.courseId}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 w-56 max-w-56 bg-card px-2 py-1 text-left font-medium"
                    >
                      <Link
                        href={`/instructor/courses/${row.courseId}?tab=clo`}
                        title={`${row.code} ${row.name} — ดูแท็บ CLO และ PLO`}
                        className="course-name-break block rounded text-primary hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <span className="mr-1.5 font-mono text-[13px] text-slate-600">
                          {row.code}
                        </span>
                        {row.name}
                      </Link>
                    </th>
                    {row.cells.map((cell, i) => (
                      <td
                        key={matrix.plos[i].ploId}
                        className={cn(CELL, !cell && 'bg-muted/50 text-muted-foreground')}
                        style={cell ? levelStyle(cell.level) : undefined}
                      >
                        {cell ? (
                          <>
                            <span aria-hidden="true" className="font-semibold">
                              {cell.total}
                            </span>
                            <span className="sr-only">
                              {row.code} เชื่อมกับ {matrix.plos[i].code} น้ำหนักรวม {cell.total}
                            </span>
                          </>
                        ) : (
                          <>
                            <span aria-hidden="true">–</span>
                            <span className="sr-only">
                              {row.code} ไม่เชื่อมกับ {matrix.plos[i].code}
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

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-700">
            <span>น้อย</span>
            <ul className="flex items-center gap-1" aria-label="คำอธิบายสี">
              {LEVELS.map((l) => (
                <li
                  key={l}
                  className="flex h-6 w-7 items-center justify-center rounded text-xs font-semibold tabular-nums"
                  style={levelStyle(l)}
                >
                  {l}
                </li>
              ))}
            </ul>
            <span>มาก</span>
            <span className="ml-3 inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-flex h-6 w-7 items-center justify-center rounded bg-muted/50 text-muted-foreground"
              >
                –
              </span>
              ไม่เชื่อมกับ PLO นั้น
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            ช่องคือน้ำหนักรวมของ CLO ในวิชานั้นที่เชื่อมกับ PLO สีเข้มสุดคือน้ำหนักรวมสูงสุด{' '}
            {CLO_PLO_CHART_NOTE}
          </p>
        </>
      )}
    </SectionCard>
  );
}
