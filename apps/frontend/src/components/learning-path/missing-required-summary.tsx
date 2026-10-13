import Link from 'next/link';
import { ArrowRight, GraduationCap } from 'lucide-react';
import type { CourseSummary, GraduationReadiness } from '@eduanalyze-ai/shared-types';
import { graduationBlockerText } from '@/lib/learning-path-plan';
import { StatCard } from '@/components/dashboard/stat-card';
import { Button } from '@/components/ui/button';

// The full list lives on /credit-checker; here it is only a pointer so the
// two pages don't render the same 39-row list.
export function MissingRequiredSummary({
  courses,
  readiness,
}: Readonly<{
  courses: CourseSummary[];
  readiness: GraduationReadiness;
}>) {
  const available = courses.filter((c) => c.isPrerequisiteSatisfied).length;
  const locked = courses.length - available;

  return (
    <StatCard
      icon={GraduationCap}
      label="วิชาบังคับที่ยังขาด"
      value={readiness.missingRequiredCount}
      suffix="วิชา"
      badge={
        readiness.isReady
          ? { text: 'ครบเงื่อนไขการจบ', tone: 'positive' }
          : { text: 'ยังไม่ครบเงื่อนไขการจบ', tone: 'neutral' }
      }
      footer={
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {courses.length === 0
              ? (graduationBlockerText(readiness) ?? 'ผ่านวิชาบังคับครบตามเกณฑ์แล้ว')
              : `ลงทะเบียนได้เลย ${available} วิชา · ติดวิชาก่อนหน้า ${locked} วิชา`}
          </p>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-auto w-full gap-1.5 whitespace-normal py-1.5"
          >
            <Link href="/credit-checker">
              ดูรายละเอียดที่หน้าตรวจสอบหน่วยกิต
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </Button>
        </div>
      }
    />
  );
}
