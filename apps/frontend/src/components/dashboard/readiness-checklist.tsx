import { CheckCircle2, CircleDashed } from 'lucide-react';
import type { GraduationReadiness } from '@eduanalyze-ai/shared-types';
import { cn } from '@/lib/utils';

// Only the three flags the dashboard already returns; the category count
// ("X of Y") is not part of this response, so it is not shown.
export function ReadinessChecklist({ readiness }: Readonly<{ readiness: GraduationReadiness }>) {
  const items = [
    {
      label: 'หน่วยกิตรวม',
      met: readiness.creditsMet,
      text: readiness.creditsMet ? 'ครบแล้ว' : 'ยังไม่ครบ',
    },
    {
      label: 'วิชาบังคับ',
      met: readiness.missingRequiredCount === 0,
      text:
        readiness.missingRequiredCount === 0
          ? 'ครบแล้ว'
          : `ขาด ${readiness.missingRequiredCount} วิชา`,
    },
    {
      label: 'หมวดวิชา',
      met: readiness.allCategoriesMet,
      text: readiness.allCategoriesMet ? 'ครบแล้ว' : 'ยังไม่ครบ',
    },
  ];

  return (
    <ul className="min-w-0 flex-1 space-y-2">
      {items.map((item) => {
        const Icon = item.met ? CheckCircle2 : CircleDashed;
        return (
          <li key={item.label} className="flex items-start gap-2 text-sm">
            <Icon
              size={16}
              aria-hidden="true"
              className={cn('mt-0.5 shrink-0', item.met ? 'text-emerald-600' : 'text-slate-400')}
            />
            <span className="text-muted-foreground">
              {item.label}{' '}
              <span className={cn('font-medium', item.met ? 'text-emerald-700' : 'text-primary')}>
                {item.text}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
