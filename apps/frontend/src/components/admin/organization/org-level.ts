import { BookOpen, Building2, GraduationCap, Landmark, type LucideIcon } from 'lucide-react';
import type { StatCardTone } from '@/components/dashboard/stat-card';
import type { OrgLevel } from '@/lib/org-tree-view';
import { BADGE_TONE_CLASSES } from '@/lib/tone';

export interface OrgLevelMeta {
  label: string;
  icon: LucideIcon;
  // The same tone drives the stat card and the icon tile of the tree rows.
  tone: StatCardTone;
  tile: string;
}

const tile = (tone: StatCardTone) =>
  tone === 'primary' ? 'bg-brand-light text-brand border-transparent' : BADGE_TONE_CLASSES[tone];

const LEVELS: Record<OrgLevel, Omit<OrgLevelMeta, 'tile'>> = {
  faculty: { label: 'คณะ', icon: Landmark, tone: 'primary' },
  department: { label: 'ภาควิชา', icon: Building2, tone: 'neutral' },
  program: { label: 'สาขา', icon: GraduationCap, tone: 'success' },
  curriculum: { label: 'หลักสูตร', icon: BookOpen, tone: 'warning' },
};

export function orgLevelMeta(level: OrgLevel): OrgLevelMeta {
  const meta = LEVELS[level];
  return { ...meta, tile: tile(meta.tone) };
}
