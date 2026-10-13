import Link from 'next/link';
import { GraduationCap, Mail, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'list', label: 'รายชื่อ', href: '/staff/students', icon: Users },
  { key: 'years', label: 'ตามชั้นปี', href: '/staff/year-levels', icon: GraduationCap },
  { key: 'invitations', label: 'คำเชิญ', href: '/staff/student-invitations', icon: Mail },
] as const;

export type StudentsTab = (typeof TABS)[number]['key'];

// The three student pages keep their own URLs; this strip just links them.
// `count` is the size of the list shown on the first tab.
export function StudentsTabs({ active, count }: Readonly<{ active: StudentsTab; count?: number }>) {
  return (
    <nav aria-label="หมวดนิสิต" className="flex flex-wrap gap-1 rounded-lg border bg-card p-1">
      {TABS.map(({ key, label, href, icon: Icon }) => {
        const isActive = key === active;
        return (
          <Link
            key={key}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-md px-3.5 text-sm font-semibold transition motion-reduce:transition-none',
              isActive
                ? 'bg-brand text-brand-foreground'
                : 'text-muted-foreground hover:bg-slate-50',
            )}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {label}
            {key === 'list' && count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-2 text-xs tabular-nums',
                  isActive ? 'bg-brand-foreground/20' : 'bg-slate-100',
                )}
              >
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
