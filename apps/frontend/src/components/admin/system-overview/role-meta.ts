import { BookOpen, Shield, ShieldCheck, UserCog, type LucideIcon } from 'lucide-react';
import { ROLE_BADGE_TONE, ROLE_LABEL_TH } from '@/components/auth/require-role';
import type { OverviewRole } from '@/lib/system-overview';
import { BAR_TONE_CLASSES, type SemanticTone } from '@/lib/tone';

export interface OverviewRoleMeta {
  role: OverviewRole;
  label: string;
  icon: LucideIcon;
  // The same tone as the role chip in the users table, so a role reads the same colour everywhere.
  tone: SemanticTone;
  // Solid fill for the accent strip and the share bar.
  fill: string;
  href: string;
}

const ICONS: Record<OverviewRole, LucideIcon> = {
  SUPER_ADMIN: ShieldCheck,
  ADMIN: Shield,
  STAFF: UserCog,
  INSTRUCTOR: BookOpen,
};

export function overviewRoleMeta(role: OverviewRole): OverviewRoleMeta {
  const tone = ROLE_BADGE_TONE[role];
  return {
    role,
    label: ROLE_LABEL_TH[role],
    icon: ICONS[role],
    tone,
    fill: BAR_TONE_CLASSES[tone],
    href: `/superadmin/users?role=${role}`,
  };
}
