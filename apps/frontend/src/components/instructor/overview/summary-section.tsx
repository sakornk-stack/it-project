import { useMemo } from 'react';
import { MinusCircle, Star, TrendingUp, Users, XCircle } from 'lucide-react';
import { type CourseSnapshot } from '@/lib/course-snapshot';
import { formatPercent } from '@/lib/format-percent';
import {
  formatCourseGpa,
  formatGradeTally,
  gradeText,
  summarizeGradeCenter,
} from '@/lib/grade-center';
import { PageSection } from '@/components/layout/page-section';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { StatCard } from '@/components/dashboard/stat-card';
import { LowSampleTag } from '../overview-parts';

// The headline numbers sit straight on the page (no card around them): each
// StatCard is its own card, so the row is one level.
export function SummarySection({
  snapshot,
  termLabel,
}: Readonly<{ snapshot: CourseSnapshot; termLabel?: string }>) {
  const { stats } = snapshot;
  const center = useMemo(() => summarizeGradeCenter(stats.counts), [stats.counts]);
  const values = center.values;
  return (
    <PageSection title="สรุปผล" description={termLabel ? `รอบล่าสุด ${termLabel}` : undefined}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <div className="col-span-2">
          <StatCard
            icon={Star}
            tone="primary"
            interactive={false}
            label="GPA ของวิชา"
            value={
              values ? (
                center.level === 'ok' ? (
                  <AnimatedNumber value={values.gpa} decimals={2} format={formatCourseGpa} />
                ) : (
                  formatCourseGpa(values.gpa)
                )
              ) : (
                '—'
              )
            }
            footer={
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {values ? (
                  <>
                    <span>≈ เกรด {gradeText(values.nearest)} (จาก 4.00)</span>
                    {center.level === 'low' && <LowSampleTag counted={center.people} />}
                  </>
                ) : (
                  <span>{formatGradeTally(stats.counts)}</span>
                )}
              </div>
            }
          />
        </div>
        <CountCard
          icon={Users}
          tone="neutral"
          label="นิสิตที่มีเกรด"
          count={stats.seats}
          note="ทุกเกรดที่บันทึกไว้"
        />
        <CountCard
          icon={TrendingUp}
          tone="success"
          label="ได้ B ขึ้นไป"
          count={stats.achieved}
          total={stats.seats}
        />
        <CountCard
          icon={XCircle}
          tone={stats.f > 0 ? 'danger' : 'neutral'}
          label="ได้ F"
          count={stats.f}
          total={stats.seats}
        />
        <CountCard
          icon={MinusCircle}
          tone={stats.w > 0 ? 'warning' : 'neutral'}
          label="ถอน (W)"
          count={stats.w}
          total={stats.seats}
        />
      </div>
    </PageSection>
  );
}

// One count with its share of everyone who has a grade in the course.
function CountCard({
  icon,
  tone,
  label,
  count,
  total,
  note,
}: Readonly<{
  icon: typeof Users;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
  label: string;
  count: number;
  total?: number;
  note?: string;
}>) {
  return (
    <StatCard
      icon={icon}
      tone={tone}
      interactive={false}
      label={label}
      value={<AnimatedNumber value={count} />}
      suffix="คน"
      footer={
        <p className="text-sm text-muted-foreground">
          {total !== undefined && total > 0
            ? `${formatPercent((count / total) * 100)} ของทั้งหมด`
            : note}
        </p>
      }
    />
  );
}
