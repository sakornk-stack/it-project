'use client';

import type { Role } from '@eduanalyze-ai/shared-types';
import { TopNavShell } from './top-nav-shell';

// The frame of every signed-in page: a green top bar and a tab row with the KU
// theme (see top-nav-shell.tsx). Each page renders it as one role; the role
// picks the tabs and the label under the user's name.
export function DashboardShell({
  role = 'STUDENT',
  ...props
}: {
  studentCode?: string;
  // Generic identity label shown next to fullName in the header — use this
  // for roles that have no student-code equivalent (e.g. instructor email).
  identityLabel?: string;
  fullName: string;
  role?: Role;
  // Opt-in loading cross-fade: pass the page's skeleton on every render of the
  // page (loading and loaded) and `ready={false}` while loading, so the
  // skeleton fades out as the content appears. Omit it and nothing changes.
  skeleton?: React.ReactNode;
  ready?: boolean;
  children: React.ReactNode;
}) {
  return <TopNavShell role={role} {...props} />;
}
