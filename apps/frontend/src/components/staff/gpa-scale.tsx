import { Progress } from '@/components/ui/progress';
import { BAR_TONE_CLASSES, type SemanticTone } from '@/lib/tone';

const GPA_MAX = 4;
// The same two cut-offs STATUS_RULES words: below 1.50 critical, 1.50-1.74
// watch, 1.75 and up normal.
export const GPA_CUTOFFS = [1.5, 1.75] as const;
const CUTOFFS = GPA_CUTOFFS;

// The band a GPA falls in, for tinting: below 1.50 danger, 1.50-1.74 warning,
// 1.75 and up success.
export function gpaTone(gpa: number): SemanticTone {
  if (gpa < GPA_CUTOFFS[0]) return 'danger';
  return gpa < GPA_CUTOFFS[1] ? 'warning' : 'success';
}
const at = (gpa: number) => `${(gpa / GPA_MAX) * 100}%`;

// A 0-4 track with the two status cut-offs marked, so a GPA reads against the
// bands instead of floating on its own. The figure and the status are printed
// as text by the caller; the track is the picture of them.
export function GpaScale({ gpa, tone }: Readonly<{ gpa: number | null; tone: SemanticTone }>) {
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Progress
          value={gpa === null ? 0 : (gpa / GPA_MAX) * 100}
          label="GPA สะสมเทียบกับเกณฑ์ 1.50 และ 1.75"
          className="h-2.5"
          barClassName={BAR_TONE_CLASSES[tone]}
        />
        {CUTOFFS.map((cutoff) => (
          <span
            key={cutoff}
            aria-hidden="true"
            className="absolute -top-0.5 h-3.5 w-0.5 -translate-x-1/2 rounded bg-slate-600"
            style={{ left: at(cutoff) }}
          />
        ))}
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">
        เส้นแบ่งเกณฑ์ที่ 1.50 และ 1.75 · เต็ม {GPA_MAX.toFixed(2)}
      </p>
    </div>
  );
}
