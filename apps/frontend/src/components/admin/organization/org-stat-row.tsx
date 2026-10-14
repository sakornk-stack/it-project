'use client';

import { StatCard } from '@/components/dashboard/stat-card';
import { Reveal } from '@/components/layout/reveal';
import { AnimatedNumber } from '@/components/ui/animated-number';
import type { OrgLevel } from '@/lib/org-tree-view';
import { orgLevelMeta } from './org-level';

const LEVELS: OrgLevel[] = ['faculty', 'department', 'program', 'curriculum'];

// Four counts, one per level. Pressing one opens the tree down to that level and moves focus
// to its first row.
export function OrgStatRow({
  counts,
  onPick,
}: Readonly<{ counts: Record<OrgLevel, number>; onPick: (level: OrgLevel) => void }>) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {LEVELS.map((level, i) => {
        const { label, icon, tone } = orgLevelMeta(level);
        const count = counts[level];
        return (
          <Reveal key={level} index={1 + i} className="h-full">
            <StatCard
              dense
              showArrow
              tone={tone}
              icon={icon}
              label={label}
              value={<AnimatedNumber value={count} />}
              onClick={() => onPick(level)}
              ariaLabel={`${label} ${count.toLocaleString('th-TH')} ${label} — เปิดต้นไม้ไปที่ระดับ${label}`}
            />
          </Reveal>
        );
      })}
    </div>
  );
}
