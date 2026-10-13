import Link from 'next/link';
import { AlertTriangle, BookOpen } from 'lucide-react';
import type { MissingRequiredCourse } from '@eduanalyze-ai/shared-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SuccessStrip } from '@/components/ui/success-strip';

const PREVIEW_COUNT = 3;

// Deterministic Credit Checker output, not AI — the copy must not claim
// otherwise (the Figma text said "ระบบ AI ได้วิเคราะห์...").
export function CreditCheckerPanel({ courses }: Readonly<{ courses: MissingRequiredCourse[] }>) {
  if (courses.length === 0) {
    return <SuccessStrip label="วิชาบังคับ" message="คุณผ่านรายวิชาบังคับครบตามเกณฑ์แล้ว" />;
  }

  const hiddenCount = courses.length - PREVIEW_COUNT;

  return (
    <Card>
      <CardHeader className="gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>วิชาบังคับที่ยังขาด {courses.length} รายวิชา</CardTitle>
          <CardDescription>
            เทียบผลการเรียนของคุณกับโครงสร้างหลักสูตรปัจจุบัน — ต้องผ่านวิชาเหล่านี้ก่อนสำเร็จการศึกษา
          </CardDescription>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href="/credit-checker">ดูรายวิชาที่ขาดทั้งหมด</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courses.slice(0, PREVIEW_COUNT).map((course) => (
            <li key={course.courseId} className="flex items-start gap-3 rounded-lg border border-slate-100 p-3">
              {course.isPrerequisiteSatisfied ? (
                <BookOpen size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
              ) : (
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className="course-name-break text-sm font-medium text-primary">
                  {course.code}: {course.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {course.credits} หน่วยกิต
                  {!course.isPrerequisiteSatisfied && ' · ยังไม่ผ่านวิชาที่ต้องเรียนก่อน'}
                </p>
              </div>
            </li>
          ))}
        </ul>
        {hiddenCount > 0 && (
          <p className="text-sm text-muted-foreground">และอีก {hiddenCount} รายวิชา</p>
        )}
      </CardContent>
    </Card>
  );
}
