import { PLO_THRESHOLD_LINE } from '@/lib/plo-notes';

// Reads the radar for someone who cannot tell the two outlines apart by colour: a line sample
// beside each label, plus one sentence on what an axis is. Placed under the chart.
export function PloRadarLegend({ threshold }: Readonly<{ threshold: number | null }>) {
  return (
    <div className="space-y-2 text-xs text-muted-foreground">
      <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
        <li className="flex items-center gap-2">
          <svg width="22" height="8" aria-hidden="true">
            <line x1="1" y1="4" x2="21" y2="4" className="stroke-brand" strokeWidth="2" />
          </svg>
          คะแนนของนิสิต
        </li>
        {threshold !== null && (
          <li className="flex items-center gap-2">
            <svg width="22" height="8" aria-hidden="true">
              <line
                x1="1"
                y1="4"
                x2="21"
                y2="4"
                className="stroke-amber-400"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
            </svg>
            เกณฑ์ผ่านของหลักสูตร
          </li>
        )}
      </ul>
      <p className="text-center">
        แต่ละมุม = PLO หนึ่งข้อ ค่าอยู่ในช่วง 0–5.0 ยิ่งห่างจากกลางยิ่งสูง
        {threshold !== null ? ` (${PLO_THRESHOLD_LINE})` : ''}
      </p>
    </div>
  );
}
