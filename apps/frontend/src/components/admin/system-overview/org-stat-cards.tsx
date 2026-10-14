'use client';

import { Building2, GraduationCap, Landmark } from 'lucide-react';
import { StatCard, type StatCardTone } from '@/components/dashboard/stat-card';
import { Reveal } from '@/components/layout/reveal';
import { AnimatedNumber } from '@/components/ui/animated-number';

const ORG_HREF = '/superadmin/organization';

interface OrgCard {
  key: string;
  icon: typeof Landmark;
  label: string;
  unit: string;
  tone: StatCardTone;
  count: number;
}

// Each card opens the organisation tree; there are no per-level tabs to deep-link into.
export function OrgStatCards({
  faculties,
  departments,
  programs,
}: Readonly<{ faculties: number; departments: number; programs: number }>) {
  const cards: OrgCard[] = [
    {
      key: 'faculty',
      icon: Landmark,
      label: 'คณะ',
      unit: 'คณะ',
      tone: 'primary',
      count: faculties,
    },
    {
      key: 'department',
      icon: Building2,
      label: 'ภาควิชา',
      unit: 'ภาควิชา',
      tone: 'neutral',
      count: departments,
    },
    {
      key: 'program',
      icon: GraduationCap,
      label: 'สาขา',
      unit: 'สาขา',
      tone: 'success',
      count: programs,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
      {cards.map((card, i) => (
        <Reveal key={card.key} index={1 + i} className="h-full">
          <StatCard
            large
            showArrow
            tone={card.tone}
            icon={card.icon}
            label={card.label}
            value={<AnimatedNumber value={card.count} />}
            suffix={card.unit}
            href={ORG_HREF}
            ariaLabel={`${card.label} ${card.count.toLocaleString('th-TH')} ${card.unit} — ไปที่โครงสร้างองค์กร`}
          />
        </Reveal>
      ))}
    </div>
  );
}
