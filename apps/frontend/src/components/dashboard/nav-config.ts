import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarClock,
  CalendarRange,
  GraduationCap,
  LayoutGrid,
  LineChart,
  ListChecks,
  Network,
  Target,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@eduanalyze-ai/shared-types';

// Kept free of React and Next so a plain unit test can pin every role's menu.

export interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  // Extra paths (the path itself or anything below it) that keep this item lit.
  // The Staff, Admin and Super Admin menus and the instructor advisee item set it; every
  // other item matches on its href alone.
  matchPrefixes?: string[];
}

const STUDENT_NAV_ITEMS: NavItem[] = [
  { label: 'แดชบอร์ด', icon: LayoutGrid, href: '/dashboard' },
  { label: 'การติดตามผลการเรียน', icon: LineChart, href: '/academic-record' },
  { label: 'ตรวจสอบหน่วยกิต', icon: ListChecks, href: '/credit-checker' },
  { label: 'การวิเคราะห์ CLO/PLO', icon: Network, href: '/clo-plo-analysis' },
  { label: 'สรุปความถนัด', icon: Target, href: '/aptitude-analysis' },
  { label: 'แผนการเรียน', icon: CalendarRange, href: '/learning-path' },
];

const INSTRUCTOR_NAV_ITEMS: NavItem[] = [
  { label: 'แดชบอร์ด', icon: LayoutGrid, href: '/instructor/dashboard' },
  { label: 'รายวิชาที่สอน', icon: BookOpen, href: '/instructor/my-courses' },
  { label: 'นิสิต', icon: Users, href: '/instructor/students' },
  { label: 'ภาพรวมชั้นปี', icon: GraduationCap, href: '/instructor/year-levels' },
  {
    label: 'นิสิตในที่ปรึกษา',
    icon: UserCheck,
    href: '/instructor/advisees',
    // One advisee's page lives under /instructor/advisees/[id].
    matchPrefixes: ['/instructor/advisees'],
  },
];

// SUPER_ADMIN lives under /superadmin and ADMIN under /admin, each tree gated
// by its own layout — so a menu must never link across the two.
const SUPER_ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'ภาพรวมระบบ', icon: LayoutGrid, href: '/superadmin/system-overview' },
  {
    label: 'ผู้ใช้งาน',
    icon: Users,
    href: '/superadmin/users',
    // A user's own page lives under /superadmin/users/[id].
    matchPrefixes: ['/superadmin/users'],
  },
  { label: 'โครงสร้างองค์กร', icon: Building2, href: '/superadmin/organization' },
  { label: 'ปีการศึกษา', icon: CalendarClock, href: '/superadmin/academic-years' },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'ภาพรวมขอบเขต', icon: LayoutGrid, href: '/admin/overview' },
  {
    label: 'ผู้ใช้งาน',
    icon: Users,
    href: '/admin/users',
    // A user's own page lives under /admin/users/[id].
    matchPrefixes: ['/admin/users'],
  },
  {
    label: 'คุณภาพหลักสูตร',
    icon: BarChart3,
    href: '/admin/curriculum',
    // The list and each curriculum's quality page (/admin/curriculum/[id]).
    matchPrefixes: ['/admin/curriculum'],
  },
  // CLO/PLO of a curriculum: one page, kept apart from /admin/curriculum so the quality
  // item above does not stay lit on it.
  { label: 'จัดการ CLO/PLO', icon: Network, href: '/admin/curriculum-outcomes' },
];

const STAFF_NAV_ITEMS: NavItem[] = [
  { label: 'ภาพรวม', icon: LayoutGrid, href: '/staff/dashboard' },
  {
    label: 'นิสิต',
    icon: GraduationCap,
    href: '/staff/students',
    // The student tabs are separate pages; the menu stays lit on all of them
    // and on a student's own page.
    matchPrefixes: ['/staff/students', '/staff/year-levels', '/staff/student-invitations'],
  },
  { label: 'หลักสูตร', icon: BookOpen, href: '/staff/curriculum' },
];

export function navItemsForRole(role: Role): NavItem[] {
  if (role === 'INSTRUCTOR') return INSTRUCTOR_NAV_ITEMS;
  if (role === 'SUPER_ADMIN') return SUPER_ADMIN_NAV_ITEMS;
  if (role === 'ADMIN') return ADMIN_NAV_ITEMS;
  if (role === 'STAFF') return STAFF_NAV_ITEMS;
  return STUDENT_NAV_ITEMS;
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  // Per-course pages have no nav entry of their own — they belong to the
  // instructor's course list, so that tab stays highlighted inside one.
  return (
    pathname === item.href ||
    (item.href === '/instructor/my-courses' && pathname.startsWith('/instructor/courses/')) ||
    (item.matchPrefixes ?? []).some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  );
}
