'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CalendarClock,
  KeyRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Reveal } from '@/components/layout/reveal';

interface QuickLink {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

// Only routes that already exist.
const QUICK_LINKS: QuickLink[] = [
  {
    href: '/superadmin/users',
    icon: Users,
    title: 'จัดการผู้ใช้งาน',
    description: 'ตรวจสอบบทบาท สิทธิ์ และสถานะบัญชี',
  },
  {
    href: '/superadmin/organization',
    icon: Building2,
    title: 'โครงสร้างองค์กร',
    description: 'จัดการคณะ ภาควิชา และสาขา',
  },
  {
    href: '/superadmin/academic-years',
    icon: CalendarClock,
    title: 'ปีการศึกษา',
    description: 'กำหนดปีการศึกษาและภาคเรียน',
  },
  {
    href: '/profile',
    icon: KeyRound,
    title: 'โปรไฟล์และความปลอดภัย',
    description: 'ข้อมูลบัญชีและการยืนยันตัวตน',
  },
];

export function QuickLinks() {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {QUICK_LINKS.map(({ href, icon: Icon, title, description }, i) => (
        <li key={href}>
          <Reveal index={6 + i} className="h-full">
            <Link
              href={href}
              className="interactive-card flex min-h-[72px] items-center gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand">
                <Icon size={20} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-primary">{title}</span>
                <span className="block text-xs text-muted-foreground">{description}</span>
              </span>
              <ArrowRight size={16} aria-hidden="true" className="go-arrow shrink-0 text-brand" />
            </Link>
          </Reveal>
        </li>
      ))}
    </ul>
  );
}
