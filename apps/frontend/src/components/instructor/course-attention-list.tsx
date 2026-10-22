import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { TrendChange } from '@/lib/course-snapshot';
import { formatPercent } from '@/lib/format-percent';
import type { AttentionRow } from '@/lib/instructor-dashboard';
import { STATUS_META } from '@/lib/instructor-overview';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { PageSection } from '@/components/layout/page-section';
import { CARD, TEXT_SECTION } from './instructor-ui';
import { GoalBar, LowSampleTag, StatusBadge } from './overview-parts';

// Words and an arrow, never a colour: a change is a fact, not a verdict.
function changeText({ points }: TrendChange): string {
  if (points === 0) return 'เท่ากับภาคก่อน';
  return `${points > 0 ? '▲ เพิ่มขึ้น' : '▼ ลดลง'} ${Math.abs(points)} จุดจากภาคก่อน`;
}

function rowLabel(row: AttentionRow): string {
  const { course, percent, threshold, status, graded, lowGrade, change } = row;
  const parts = [`${course.code} ${course.name}`];
  if (status === 'few') parts.push(`นิสิตน้อย (${graded} คน)`);
  else parts.push(STATUS_META[status].label);
  if (percent !== null) {
    parts.push(
      `ได้ B ขึ้นไป ${formatPercent(percent)}` +
        (threshold === null ? '' : ` เกณฑ์ ${formatPercent(threshold)}`),
    );
  }
  if (change) parts.push(changeText(change));
  if (lowGrade > 0) parts.push(`ได้ D+ ลงไป ${lowGrade} คน`);
  return `${parts.join(', ')} — เปิดหน้ารายวิชา`;
}

function AttentionItem({ row }: Readonly<{ row: AttentionRow }>) {
  const { course, percent, threshold, status, graded, lowGrade, change, shortBy, termLabel } = row;
  return (
    <li>
      <Link
        href={`/instructor/courses/${course.courseId}`}
        aria-label={rowLabel(row)}
        className={cn(
          CARD,
          'interactive-row group flex flex-col gap-3 px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:px-5',
        )}
      >
        <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge tone="neutral" className="shrink-0 font-mono">
            {course.code}
          </Badge>
          <span className="min-w-0 flex-1 basis-40">
            <span className="course-name-break block font-semibold text-primary">
              {course.name}
            </span>
            <span className="block text-[13px] text-muted-foreground">
              นิสิต {graded} คน{termLabel ? ` · ${termLabel}` : ''}
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-2">
            {status === 'few' ? (
              <LowSampleTag counted={graded} />
            ) : (
              <StatusBadge
                status={status}
                label={shortBy === null ? undefined : `ต่ำกว่าเกณฑ์ ${shortBy} จุด`}
              />
            )}
            {lowGrade > 0 && (
              <Badge tone={status === 'met' ? 'neutral' : 'warning'} className="whitespace-nowrap">
                D+ ลงไป {lowGrade} คน
              </Badge>
            )}
            <ArrowRight
              size={16}
              aria-hidden="true"
              className="go-arrow shrink-0 text-muted-foreground"
            />
          </span>
        </span>
        {/* No grade yet: the status chip above already says so. */}
        {percent !== null && (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
            <span className="shrink-0 tabular-nums text-muted-foreground">
              ได้ B ขึ้นไป{' '}
              <span className="text-base font-semibold text-primary">{formatPercent(percent)}</span>
            </span>
            <GoalBar
              percent={percent}
              target={threshold}
              status={status === 'few' ? 'none' : status}
              className="min-w-32 flex-1 basis-40"
            />
            {threshold !== null && (
              <span className="shrink-0 tabular-nums text-muted-foreground">
                เกณฑ์ {formatPercent(threshold)}
              </span>
            )}
            {change && (
              <span
                className="shrink-0 whitespace-nowrap tabular-nums text-muted-foreground"
                title={`${change.toLabel} เทียบกับ ${change.fromLabel}`}
              >
                {changeText(change)}
              </span>
            )}
          </span>
        )}
      </Link>
    </li>
  );
}

// Every course the instructor teaches, the one furthest below its bar first.
// The whole row opens the course page. "ต้องดูก่อน" only while some course is
// short of its bar; otherwise the list is just the courses.
export function CourseAttentionList({ rows }: Readonly<{ rows: AttentionRow[] }>) {
  const anyShort = rows.some((r) => r.status === 'below' || r.status === 'near');
  return (
    <PageSection
      title={anyShort ? 'ต้องดูก่อน' : 'รายวิชาที่สอน'}
      titleClassName={TEXT_SECTION}
      description="เรียงจากวิชาที่ห่างเกณฑ์มากที่สุด แท่งคือสัดส่วนนิสิตที่ได้ B ขึ้นไป ขีดตั้งคือเกณฑ์ของวิชา"
    >
      <ul className="space-y-3">
        {rows.map((row) => (
          <AttentionItem key={row.course.courseId} row={row} />
        ))}
      </ul>
    </PageSection>
  );
}
