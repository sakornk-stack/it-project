import Link from 'next/link';
import { Network } from 'lucide-react';
import type { PloLink } from '@/lib/instructor-dashboard';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/ui/section-card';

// Which PLO of the curriculum each of the instructor's courses feeds, through
// which CLO and how strongly. No achievement bar: a course has one share at B or
// above, so every PLO of that course would repeat it (the per-course figure
// lives on the course page's CLO และ PLO tab).
export function PloLinksSection({ links }: Readonly<{ links: PloLink[] }>) {
  return (
    <SectionCard
      icon={Network}
      title="วิชาของคุณกับ PLO ของหลักสูตร"
      description="PLO ที่ CLO ของวิชาคุณเชื่อมไว้ ตัวเลขในวงเล็บคือน้ำหนัก 1–5 (มาก = มีผลต่อ PLO ข้อนั้นมาก)"
    >
      <ul className="-my-3 divide-y divide-slate-100">
        {links.map((link) => (
          <li
            key={link.ploId}
            className="flex flex-col gap-2 py-3 md:flex-row md:items-start md:gap-4"
          >
            <div className="flex min-w-0 items-start gap-3 md:w-2/5 md:shrink-0">
              <Badge tone="neutral" className="min-w-16 shrink-0 justify-center font-semibold">
                {link.code}
              </Badge>
              <p className="min-w-0 break-words text-sm text-primary">{link.name}</p>
            </div>
            <ul
              className="flex min-w-0 flex-wrap gap-2"
              aria-label={`วิชาที่เชื่อมกับ ${link.code}`}
            >
              {link.courses.map((course) => (
                <li key={course.courseId} className="min-w-0">
                  <Link
                    href={`/instructor/courses/${course.courseId}?tab=clo`}
                    title={`${course.code} ${course.name} — ดูแท็บ CLO และ PLO`}
                    className="inline-flex min-h-11 max-w-full flex-wrap items-center gap-x-1.5 rounded-lg border border-slate-200 bg-card px-3 py-1.5 text-sm transition-colors hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 motion-reduce:transition-none"
                  >
                    <span className="font-mono font-semibold text-primary">{course.code}</span>
                    <span className="text-muted-foreground">
                      {course.clos.map((clo) => `${clo.code} (${clo.weight})`).join(', ')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
