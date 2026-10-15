'use client';

import { ALL, type GradeFilter, type PersonCounts } from '@/lib/student-directory';
import { LOW_GRADE_LABEL } from '@/lib/low-grade';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Two buttons that double as the numbers: each shows how many people it would
// leave. 44px tall at every width (touch), the design system's default Button height.
export function LowGradeFilterChips({
  counts,
  value,
  onChange,
}: Readonly<{
  counts: PersonCounts;
  value: GradeFilter;
  onChange: (grade: GradeFilter) => void;
}>) {
  const options: { value: GradeFilter; label: string; count: number; warn?: boolean }[] = [
    { value: ALL, label: 'ทั้งหมด', count: counts.total },
    { value: 'LOW', label: LOW_GRADE_LABEL, count: counts.low, warn: true },
  ];

  return (
    <div role="group" aria-label="กรองตามเกรดล่าสุด" className="flex flex-wrap items-center gap-2">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={selected ? 'default' : 'outline'}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn('h-11 gap-2', selected && 'font-semibold')}
          >
            {option.label}
            {option.warn && option.count > 0 ? (
              <Badge tone="warning">
                <AnimatedNumber value={option.count} />
              </Badge>
            ) : (
              <span className={selected ? undefined : 'text-muted-foreground'}>
                <AnimatedNumber value={option.count} />
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
