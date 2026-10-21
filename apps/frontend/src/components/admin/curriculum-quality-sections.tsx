import type {
  CohortPloAchievementReport,
  LowestCloEntry,
  RadarPoint,
  RiskLevel,
} from '@eduanalyze-ai/shared-types';
import { RISK_LEVEL_LABELS, RISK_LEVEL_TONES } from '@/lib/risk-level';
import {
  CLOSE_SCORES_NOTE,
  LITTLE_DATA_LABEL,
  formatGpa,
  gpaStatus,
  ploScoresAreClose,
  gpaBarPercent,
  hasLittleData,
  sortCohorts,
  summarizeLowestClos,
} from '@/lib/admin-curriculum-quality';
import { formatFiveScaleAgainstThreshold } from '@/lib/five-scale';
import { BAR_TONE_CLASSES } from '@/lib/tone';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { STATUS_RULES } from '@/components/staff/staff-status';
import { NO_DATA_LABEL } from '@/components/staff/student-reading';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { GradeEstimateBadge } from '@/components/ui/grade-estimate-badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Info, Layers } from 'lucide-react';

const LEGEND_ORDER: RiskLevel[] = ['CRITICAL', 'WATCH', 'NORMAL'];

// Each item is a dot (its colour repeats the tone) plus the status name and its
// rule in text, so the meaning never rests on colour. Rules come from the same
// STATUS_RULES the Staff pages print.
const DOT_CLASSES = BAR_TONE_CLASSES;

function LegendItem({
  dot,
  name,
  rule,
}: Readonly<{ dot: keyof typeof DOT_CLASSES; name: string; rule: string }>) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span
        aria-hidden="true"
        className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', DOT_CLASSES[dot])}
      />
      <span>
        <span className="font-semibold text-primary">{name}</span>
        <span className="text-muted-foreground"> = {rule}</span>
      </span>
    </li>
  );
}

export function StatusCriteria() {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <p className="text-sm font-semibold text-primary">
          เกณฑ์สถานะนิสิต (เกณฑ์เดียวกันทั้งระบบ)
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {LEGEND_ORDER.map((level) => (
            <LegendItem
              key={level}
              dot={RISK_LEVEL_TONES[level]}
              name={RISK_LEVEL_LABELS[level]}
              rule={STATUS_RULES[level]}
            />
          ))}
          <LegendItem dot="neutral" name={NO_DATA_LABEL} rule={STATUS_RULES.NO_DATA} />
        </ul>
      </CardContent>
    </Card>
  );
}

export function LowestSection({
  plos,
  clos,
  threshold = null,
}: Readonly<{
  plos: RadarPoint[];
  clos: LowestCloEntry[];
  // Pass bar (0-100) so a score just under it is never rounded up to look like it.
  threshold?: number | null;
}>) {
  const { shown, hiddenCount } = summarizeLowestClos(clos);
  const none = plos.length === 0 && clos.length === 0;
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle>PLO / CLO ที่ต่ำสุด</CardTitle>
        {!none && <GradeEstimateBadge />}
      </CardHeader>
      <CardContent className="space-y-5">
        {none ? (
          <EmptyState
            icon={Info}
            description="ยังไม่มีผลการประเมิน PLO/CLO ของหลักสูตรนี้ จึงยังจัดอันดับไม่ได้"
          />
        ) : (
          <>
            {plos.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">
                  PLO ที่ต่ำที่สุด (คะแนนเต็ม 5)
                </h4>
                {ploScoresAreClose(plos) && (
                  <p className="text-xs text-muted-foreground">{CLOSE_SCORES_NOTE}</p>
                )}
                <ol className="space-y-2">
                  {plos.map((plo, index) => (
                    <li
                      key={plo.ploId}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-md bg-muted/50 px-3 py-3"
                    >
                      <span className="min-w-0 break-words text-sm">
                        {index + 1}. <span className="font-semibold text-primary">{plo.code}</span>{' '}
                        {plo.name}
                      </span>
                      <Badge tone="warning" className="tabular-nums">
                        เฉลี่ย{' '}
                        {formatFiveScaleAgainstThreshold(
                          plo.value,
                          threshold,
                          plo.value !== null && threshold !== null && plo.value >= threshold,
                        )}{' '}
                        / 5.0
                      </Badge>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {shown.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground">
                  CLO ที่ต่ำที่สุด (สัดส่วนนิสิตที่ได้ B ขึ้นไป)
                </h4>
                <ul className="space-y-2">
                  {shown.map((clo) => (
                    <li
                      key={clo.cloId}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-md bg-muted/50 px-3 py-3"
                    >
                      <span className="min-w-0 break-words text-sm">
                        <span className="font-semibold text-primary">{clo.code}</span> ·{' '}
                        {clo.courseCode} {clo.courseName}
                      </span>
                      <Badge tone="warning" className="tabular-nums">
                        {clo.achievementPercent.toFixed(2)}% ได้ B ขึ้นไป
                      </Badge>
                    </li>
                  ))}
                </ul>
                {hiddenCount > 0 && (
                  <p className="text-sm text-muted-foreground">
                    และอีก {hiddenCount} CLO ที่มีค่าเท่ากัน (CLO
                    ในรายวิชาเดียวกันใช้ค่าของรายวิชานั้น)
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CohortRow({ cohort }: Readonly<{ cohort: CohortPloAchievementReport }>) {
  const little = hasLittleData(cohort.gpaSampleSize);
  const status = gpaStatus(cohort.averageGpa);
  return (
    <li className="space-y-2 rounded-lg bg-muted/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-primary">รุ่นปี {cohort.admissionYear}</p>
        <Badge tone="neutral" className="tabular-nums">
          {cohort.studentCount} คน
        </Badge>
      </div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted-foreground">GPA เฉลี่ยรุ่น</span>
        <span className="font-semibold tabular-nums text-primary">
          {cohort.averageGpa === null ? (
            NO_DATA_LABEL
          ) : (
            <>
              <AnimatedNumber value={cohort.averageGpa} decimals={2} format={formatGpa} /> / 4.00
            </>
          )}
        </span>
      </div>
      <Progress
        value={gpaBarPercent(cohort.averageGpa)}
        label={`GPA เฉลี่ยรุ่นปี ${cohort.admissionYear}`}
        barClassName={status ? BAR_TONE_CLASSES[status.tone] : BAR_TONE_CLASSES.neutral}
      />
      <div className="flex flex-wrap items-center gap-2">
        {status && <Badge tone={status.tone}>{status.label}</Badge>}
        {little && <Badge tone="warning">{LITTLE_DATA_LABEL}</Badge>}
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        คำนวณจากนิสิตที่มีเกรด {cohort.gpaSampleSize} จาก {cohort.studentCount} คน
      </p>
    </li>
  );
}

export function CohortComparison({ cohorts }: Readonly<{ cohorts: CohortPloAchievementReport[] }>) {
  const sorted = sortCohorts(cohorts);
  return (
    <Card>
      <CardHeader>
        <CardTitle>เทียบรุ่น (ปีที่เข้าศึกษา)</CardTitle>
        <p className="text-sm text-muted-foreground">เรียงจากรุ่นล่าสุด</p>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <EmptyState icon={Layers} description="ยังไม่มีนิสิตในรุ่นใดของหลักสูตรนี้" />
        ) : (
          <ul className="space-y-3">
            {sorted.map((cohort) => (
              <CohortRow key={cohort.admissionYear} cohort={cohort} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
