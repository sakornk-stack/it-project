import Link from 'next/link';
import type { IncompleteElectiveCategory } from '@eduanalyze-ai/shared-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ElectiveProgressPanel({
  categories,
}: Readonly<{ categories: IncompleteElectiveCategory[] }>) {
  if (categories.length === 0) return null;

  return (
    <Card>
      <CardHeader className="gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>วิชาเลือกที่ยังไม่ครบตามเกณฑ์ {categories.length} หมวด</CardTitle>
          <CardDescription>หมวดที่ยังต้องสะสมหน่วยกิตเพิ่มก่อนสำเร็จการศึกษา</CardDescription>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href="/learning-path">ดูวิชาที่แนะนำในแผนการเรียน</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <li key={category.categoryId} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-primary">{category.name}</p>
              <p className="text-xs text-muted-foreground">
                สะสมแล้ว {category.creditsEarned} / {category.minCredits} หน่วยกิต · ขาดอีก{' '}
                {category.creditsShort}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
