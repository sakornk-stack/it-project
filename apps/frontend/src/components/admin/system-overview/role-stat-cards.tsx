'use client';

import { StatCard } from '@/components/dashboard/stat-card';
import { Reveal } from '@/components/layout/reveal';
import { AnimatedNumber } from '@/components/ui/animated-number';
import type { SystemUserCounts } from '@/lib/system-overview';
import { roleShares } from '@/lib/system-overview';
import { overviewRoleMeta } from './role-meta';

// One card per account role, tinted with the role's own colour. Each opens the users list
// already narrowed to that role (?role=), including a role that has no accounts.
export function RoleStatCards({ counts }: Readonly<{ counts: SystemUserCounts }>) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {roleShares(counts).map(({ role, count }, i) => {
        const meta = overviewRoleMeta(role);
        return (
          <Reveal key={role} index={2 + i} className="h-full">
            <StatCard
              large
              showArrow
              tone={meta.tone}
              accentClassName={meta.fill}
              icon={meta.icon}
              label={meta.label}
              value={<AnimatedNumber value={count} />}
              suffix="คน"
              href={meta.href}
              ariaLabel={`${meta.label} ${count.toLocaleString('th-TH')} คน — ไปที่รายชื่อผู้ใช้งานเฉพาะบทบาทนี้`}
            />
          </Reveal>
        );
      })}
    </div>
  );
}
