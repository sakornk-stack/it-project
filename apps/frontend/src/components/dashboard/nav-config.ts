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
  // Only the Staff and Admin menus set it; every other item matches on its href alone.
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
];

// SUPER_ADMIN-only pages (e.g. academic-years) don't belong in plain
// ADMIN's nav — the two used to be lumped into one array, which would have
// shown ADMIN a link into a page RequireRole immediately blocks them from.
const SUPER_ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'ภาพรวมระบบ', icon: LayoutGrid, href: '/admin/system-overview' },
  { label: 'ผู้ใช้งาน', icon: Users, href: '/admin/users' },
  { label: 'โครงสร้างองค์กร', icon: Building2, href: '/admin/organization' },
  { label: 'ปีการศึกษา', icon: CalendarClock, href: '/admin/academic-years' },
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
  // Per-course pages have no nav entry of their own — keep the
  // instructor overview highlighted while inside one.
  return (
    pathname === item.href ||
    (item.href === '/instructor/dashboard' && pathname.startsWith('/instructor/courses/')) ||
    (item.matchPrefixes ?? []).some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  );
}
