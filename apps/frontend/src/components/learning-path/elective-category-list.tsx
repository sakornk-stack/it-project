import { Inbox, Info } from 'lucide-react';
import type { IncompleteElectiveCategory } from '@eduanalyze-ai/shared-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, InlineNotice } from '@/components/ui/empty-state';

export function ElectiveCategoryList({
  categories,
  courseCountByCategory,
}: Readonly<{
  categories: IncompleteElectiveCategory[];
  courseCountByCategory: Map<string, number>;
}>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>หมวดวิชาเลือกที่ยังไม่ครบ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {categories.length === 0 && (
          <EmptyState illustration="all-done" size="sm" description="นิสิตผ่านหมวดวิชาเลือกครบตามเกณฑ์แล้ว" />
        )}
        {categories.map((category) => {
          const hasCatalog = (courseCountByCategory.get(category.categoryId) ?? 0) > 0;

          return (
            <div key={category.categoryId} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                <span className="font-medium text-primary">{category.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {category.creditsEarned} / {category.minCredits} หน่วยกิต (ขาด {category.creditsShort})
                </span>
              </div>

              {category.availableElectivesInCategory.length > 0 ? (
                <div className="space-y-2">
                  {category.availableElectivesInCategory.map((course) => (
                    <div
                      key={course.courseId}
                      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-border p-3"
                    >
                      <p className="min-w-0 text-sm font-medium text-primary">
                        {course.code}: {course.name}
                      </p>
                      <span className="text-xs text-muted-foreground">{course.credits} หน่วยกิต</span>
                    </div>
                  ))}
                </div>
              ) : hasCatalog ? (
                <InlineNotice icon={Inbox}>
                  มีวิชาในหมวดนี้ แต่ยังไม่มีวิชาที่ลงทะเบียนได้ในขณะนี้
                </InlineNotice>
              ) : (
                // Free Elective / some Gen Ed groups are university-wide by
                // design (PROJECT_CONTEXT.md's "generic across programs"
                // principle) — too many courses across every faculty to
                // import into this system, decided at Phase 4. This is
                // expected, not missing data, so the copy explains why
                // instead of reading like a broken/incomplete page.
                <InlineNotice icon={Info}>
                  หมวดนี้ยังขาดอีก {category.creditsShort} หน่วยกิต — เลือกได้จากทุกคณะทั่วมหาวิทยาลัย
                  ระบบยังไม่มีรายชื่อวิชาให้แนะนำในหมวดนี้ ติดต่อฝ่ายทะเบียนหรือเลือกจากรายวิชาเปิดสอนในระบบทะเบียนกลาง
                </InlineNotice>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
