'use client';

import { KeyRound, ShieldOff, UserCheck, UserCog, UsersRound } from 'lucide-react';
import { StatCard } from '@/components/dashboard/stat-card';
import { Reveal } from '@/components/layout/reveal';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { activeShare, type UserSummary } from '@/lib/admin-users';
import type { UserFiltersControl } from '@/lib/use-user-filters';
import { ALL, toggleStatus, type StatusFilter } from '@/lib/user-list-filter';

// Four cards for a Super Admin, three for an Admin. Each is a filter: it narrows the
// list to its status, and pressing it again clears that.
export function UserStatCards({
  summary,
  requesterIsSuperAdmin,
  control,
}: Readonly<{
  summary: UserSummary;
  requesterIsSuperAdmin: boolean;
  control: UserFiltersControl;
}>) {
  const { filters, update } = control;
  const share = activeShare(summary);

  const byStatus = (status: StatusFilter) => ({
    selected: filters.status === status,
    onSelect: () => update({ status: toggleStatus(filters.status, status) }),
  });

  const cards = [
    <StatCard
      key="total"
      dense
      icon={UsersRound}
      label={requesterIsSuperAdmin ? 'บัญชีบุคลากรทั้งหมด' : 'บัญชีทั้งหมด'}
      value={<AnimatedNumber value={summary.total} />}
      caption="ทุกสถานะ"
      dimmed={summary.total === 0}
      selected={filters.status === ALL && filters.role === ALL}
      onSelect={() => update({ status: ALL, role: ALL })}
    />,
    requesterIsSuperAdmin ? (
      <StatCard
        key="pending"
        dense
        tone="warning"
        icon={KeyRound}
        label="รอตั้งรหัสผ่าน"
        value={<AnimatedNumber value={summary.pendingPassword} />}
        caption="ยังไม่ได้ตั้งรหัสผ่านครั้งแรก"
        dimmed={summary.pendingPassword === 0}
        {...byStatus('PENDING')}
      />
    ) : (
      <StatCard
        key="staff"
        dense
        icon={UserCog}
        label="เจ้าหน้าที่"
        value={<AnimatedNumber value={summary.byRole.STAFF} />}
        caption="ในขอบเขตที่รับผิดชอบ"
        dimmed={summary.byRole.STAFF === 0}
        selected={filters.role === 'STAFF'}
        onSelect={() =>
          update(filters.role === 'STAFF' ? { role: ALL } : { role: 'STAFF', status: ALL })
        }
      />
    ),
    requesterIsSuperAdmin && (
      <StatCard
        key="active"
        dense
        tone="success"
        icon={UserCheck}
        label="ใช้งานอยู่"
        value={<AnimatedNumber value={summary.active} />}
        caption={share === null ? 'บัญชีที่เปิดใช้งาน' : `${share.toFixed(1)}% ของบัญชีทั้งหมด`}
        dimmed={summary.active === 0}
        {...byStatus('ACTIVE')}
      />
    ),
    <StatCard
      key="suspended"
      dense
      tone="danger"
      icon={ShieldOff}
      label="ระงับการใช้งาน"
      value={<AnimatedNumber value={summary.suspended} />}
      caption="เข้าสู่ระบบไม่ได้"
      dimmed={summary.suspended === 0}
      {...byStatus('SUSPENDED')}
    />,
  ].filter((card): card is JSX.Element => card !== false);

  return (
    <div className="space-y-3">
      <div
        className={
          requesterIsSuperAdmin
            ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'
            : 'grid grid-cols-1 gap-4 sm:grid-cols-3'
        }
      >
        {/* One Reveal per card: the shared entrance, staggered by position. */}
        {cards.map((card, i) => (
          <Reveal key={card.key} index={1 + i} className="h-full">
            {card}
          </Reveal>
        ))}
      </div>
      {summary.withoutScope > 0 && (
        <p className="text-sm font-medium text-amber-700">
          มี {summary.withoutScope} บัญชีที่ยังไม่กำหนดขอบเขต
        </p>
      )}
    </div>
  );
}
