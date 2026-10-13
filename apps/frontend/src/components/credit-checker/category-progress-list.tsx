import type { CategoryProgress } from '@eduanalyze-ai/shared-types';
import { BAR_TONE_CLASSES } from '@/lib/tone';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';

export function CategoryProgressList({ categories }: Readonly<{ categories: CategoryProgress[] }>) {
  return (
    <Card>
      <CardContent className="pt-6">
        {categories.length === 0 ? (
          <EmptyState illustration="no-data" description="ยังไม่มีข้อมูลหมวดวิชา" />
        ) : (
          <ul className="grid grid-cols-1 gap-x-10 gap-y-5 lg:grid-cols-2">
            {categories.map((category) => (
              <li key={category.categoryId} className="space-y-1.5">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-sm">
                  <span className="min-w-0 font-medium text-primary">{category.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-muted-foreground">
                      {category.creditsEarned} / {category.minCredits} หน่วยกิต
                      {category.creditsEarned > category.minCredits &&
                        ` · เกิน ${category.creditsEarned - category.minCredits}`}
                    </span>
                    <Badge tone={category.isComplete ? 'success' : 'warning'}>
                      {category.isComplete ? 'ครบแล้ว' : 'ยังไม่ครบ'}
                    </Badge>
                  </div>
                </div>
                <Progress
                  label={category.name}
                  className={category.isComplete ? 'h-1.5' : undefined}
                  barClassName={category.isComplete ? BAR_TONE_CLASSES.success : undefined}
                  value={category.minCredits > 0 ? (category.creditsEarned / category.minCredits) * 100 : 0}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
