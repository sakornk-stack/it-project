import { Check } from 'lucide-react';
import type { CategoryProgress } from '@eduanalyze-ai/shared-types';
import { cn } from '@/lib/utils';
import { BAR_TONE_CLASSES, TEXT_TONE_CLASSES } from '@/lib/tone';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';

// Unfinished categories first (they need attention), each group keeping the API order.
const unfinishedFirst = (categories: CategoryProgress[]) => [
  ...categories.filter((c) => !c.isComplete),
  ...categories.filter((c) => c.isComplete),
];

// Subtitle for the section: how many categories are done and how many still are not.
export function CategoryProgressSummary({
  categories,
}: Readonly<{ categories: CategoryProgress[] }>) {
  const total = categories.length;
  if (total === 0) return null;
  const done = categories.filter((c) => c.isComplete).length;
  const remaining = total - done;
  if (remaining === 0) {
    return (
      <span className={cn('inline-flex items-center gap-1.5', TEXT_TONE_CLASSES.success)}>
        <Check size={14} aria-hidden="true" />
        ครบทุกหมวดแล้ว ({done} จาก {total})
      </span>
    );
  }
  if (done === 0) return <>ยังไม่ครบ {total} หมวด</>;
  return (
    <>
      ครบแล้ว {done} จาก {total} หมวด · ยังไม่ครบ {remaining} หมวด
    </>
  );
}

export function CategoryProgressList({ categories }: Readonly<{ categories: CategoryProgress[] }>) {
  return (
    <Card>
      <CardContent className="pt-6">
        {categories.length === 0 ? (
          <EmptyState illustration="no-data" description="ยังไม่มีข้อมูลหมวดวิชา" />
        ) : (
          <ul className="grid grid-cols-1 gap-x-10 gap-y-5 lg:grid-cols-2">
            {unfinishedFirst(categories).map((category) => {
              const shortage = category.minCredits - category.creditsEarned;
              const over = category.creditsEarned - category.minCredits;
              return (
                <li key={category.categoryId} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-sm">
                    <span
                      className={cn(
                        'min-w-0 break-words',
                        category.isComplete
                          ? 'text-muted-foreground'
                          : 'font-medium text-primary',
                      )}
                    >
                      {category.name}
                    </span>
                    <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                      <span className="tabular-nums text-muted-foreground">
                        {category.creditsEarned} / {category.minCredits} หน่วยกิต
                        {over > 0 && ` · เกิน ${over}`}
                      </span>
                      {category.isComplete ? (
                        <span className={cn('inline-flex items-center gap-1 text-xs', TEXT_TONE_CLASSES.success)}>
                          <Check size={12} aria-hidden="true" />
                          ครบแล้ว
                        </span>
                      ) : (
                        <Badge tone="warning">
                          {shortage > 0 ? `ขาด ${shortage} หน่วยกิต` : 'ยังไม่ครบเงื่อนไข'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Progress
                    label={category.name}
                    className={cn('mt-auto', category.isComplete && 'h-1')}
                    barClassName={
                      category.isComplete ? cn(BAR_TONE_CLASSES.success, 'opacity-60') : undefined
                    }
                    value={
                      category.minCredits > 0
                        ? (category.creditsEarned / category.minCredits) * 100
                        : 0
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
