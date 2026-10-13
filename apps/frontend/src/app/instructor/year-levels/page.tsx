'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchInstructorDashboard,
  fetchInstructorStudents,
  fetchInstructorYearLevels,
} from '@/lib/api/instructor';
import { buildCourseOverviews, buildCourseYearMatrix } from '@/lib/instructor-overview';
import { buildYearLevelsFigures, lowGradeIds } from '@/lib/student-directory';
import { LOW_GRADE_LABEL, LOW_GRADE_RULE } from '@/lib/low-grade';
import { useAuth } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { RequireRole } from '@/components/auth/require-role';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { YearLevelMatrix } from '@/components/instructor/year-level-matrix';
import { InstructorYearLevelOverview } from '@/components/instructor/instructor-year-level-overview';
import { TEXT_PAGE, TEXT_SECTION } from '@/components/instructor/instructor-ui';
import { StatTile } from '@/components/instructor/stat-tile';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { PageHeader } from '@/components/layout/page-header';
import { Reveal } from '@/components/layout/reveal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { Skeleton, StatCardsSkeleton } from '@/components/ui/skeleton';
import { PageSection } from '@/components/layout/page-section';

export default function InstructorYearLevelsPage() {
  return (
    <ProtectedRoute>
      <InstructorYearLevelsContent />
    </ProtectedRoute>
  );
}

function InstructorYearLevelsContent() {
  const { user } = useAuth();
  const isInstructor = !!user?.roles.includes('INSTRUCTOR');

  const query = useQuery({
    queryKey: ['instructor-year-levels'],
    queryFn: fetchInstructorYearLevels,
    enabled: isInstructor,
  });
  // Same key as the students page, so the two share one cache entry. Year
  // levels carry no grades of their own; this supplies them per student.
  const studentsQuery = useQuery({
    queryKey: ['instructor-students'],
    queryFn: () => fetchInstructorStudents({}),
    enabled: isInstructor,
  });

  // Same key as the dashboard: the per-course grade tally and the goal of each course.
  const dashboardQuery = useQuery({
    queryKey: ['instructor-dashboard'],
    queryFn: fetchInstructorDashboard,
    enabled: isInstructor,
  });
  // Credits only weight the overall grade average, which this page does not show,
  // so it is not requested here.
  const courses = useMemo(() => dashboardQuery.data?.courses ?? [], [dashboardQuery.data]);

  const buckets = useMemo(() => query.data?.buckets ?? [], [query.data]);
  const lowIds = useMemo(
    () => (studentsQuery.data ? lowGradeIds(studentsQuery.data.students) : null),
    [studentsQuery.data],
  );
  const matrix = useMemo(() => {
    if (!studentsQuery.data || !query.data || courses.length === 0) return null;
    const levelByStudent = new Map<string, number>();
    for (const b of query.data.buckets)
      for (const st of b.students) levelByStudent.set(st.studentProfileId, b.yearLevel);
    return buildCourseYearMatrix(
      buildCourseOverviews(courses),
      studentsQuery.data.students,
      levelByStudent,
    );
  }, [studentsQuery.data, query.data, courses]);
  const totalStudents = buckets.reduce((sum, b) => sum + b.students.length, 0);
  // Wait for the students data (or its failure) so the badges and the header line
  // do not pop in a moment after the cards.
  const ready =
    !!query.data &&
    (studentsQuery.isSuccess || studentsQuery.isError) &&
    (dashboardQuery.isSuccess || dashboardQuery.isError);
  const figures = ready ? buildYearLevelsFigures(buckets, lowIds) : null;

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-3">
          <Skeleton className="mx-auto h-10 w-10 rounded-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    );
  }

  return (
    <RequireRole role="INSTRUCTOR">
      <DashboardShell role="INSTRUCTOR" identityLabel={user.email} fullName={user.fullName}>
        <Reveal index={0}>
          <PageHeader
            title="ภาพรวมชั้นปี"
            description="นิสิตที่เคยเรียนวิชาของคุณ แบ่งตามชั้นปี (ไม่รวมนิสิตทั้งหลักสูตร)"
            titleClassName={TEXT_PAGE}
          />
        </Reveal>

        {(query.isLoading || (!!query.data && !ready)) && (
          <StatCardsSkeleton count={4} className="md:grid-cols-2 xl:grid-cols-4" />
        )}

        {query.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              ไม่สามารถโหลดข้อมูลภาพรวมชั้นปีได้ กรุณาลองใหม่อีกครั้ง
            </AlertDescription>
          </Alert>
        )}

        {ready && totalStudents === 0 && (
          <Reveal index={1}>
            <Card>
              <CardContent className="pt-6">
                <EmptyState
                  illustration="no-students"
                  description="ยังไม่มีนิสิตที่เกี่ยวข้องกับวิชาที่คุณสอน ชั้นปีจะขึ้นที่นี่เมื่อมีนิสิตลงเรียน"
                  action={
                    <Button asChild variant="outline">
                      <Link href="/instructor/my-courses">ดูรายวิชาที่สอน</Link>
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          </Reveal>
        )}

        {figures && figures.total > 0 && (
          <Reveal index={1}>
            <dl className="grid gap-3 sm:grid-cols-3">
              <StatTile
                label="นิสิต"
                unit="คน"
                value={<AnimatedNumber value={figures.total} />}
                extra={
                  <span className="text-[13px] text-muted-foreground">ที่เคยเรียนวิชาของคุณ</span>
                }
              />
              <StatTile
                label={`${LOW_GRADE_LABEL}ในวิชาของคุณ`}
                unit={figures.lowGrade === null ? undefined : 'คน'}
                zero={figures.lowGrade === 0}
                value={
                  figures.lowGrade === null ? '—' : <AnimatedNumber value={figures.lowGrade} />
                }
                extra={
                  <span className="text-[13px] text-muted-foreground">
                    {figures.lowGrade === null ? 'โหลดข้อมูลรายวิชาไม่ได้' : LOW_GRADE_RULE}
                  </span>
                }
              />
              <StatTile
                label="หน่วยกิตน้อยกว่าที่ควรมี"
                unit="คน"
                zero={figures.behind === 0}
                value={<AnimatedNumber value={figures.behind} />}
                extra={
                  <span className="text-[13px] text-muted-foreground">เทียบกับแผนตามชั้นปี</span>
                }
              />
            </dl>
          </Reveal>
        )}

        {ready && totalStudents > 0 && matrix && matrix.levels.length > 0 && (
          <Reveal index={1}>
            <PageSection
              title="เกรดกลาง แยกตามวิชาและชั้นปี"
              titleClassName={TEXT_SECTION}
              description="นับเป็นที่นั่ง คนที่เรียนหลายวิชานับในแต่ละวิชา กดที่วิชาเพื่อดูรายละเอียด"
            >
              <details className="group rounded-md border border-slate-200 bg-slate-50 px-3">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  วิธีอ่านตาราง
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  />
                </summary>
                <ul className="list-disc space-y-1 pb-3 pl-5 text-sm text-muted-foreground">
                  <li>ตัวใหญ่ในช่องคือเกรดกลางของกลุ่มนั้น พื้นหลังเข้มขึ้นเมื่อเกรดสูงขึ้น</li>
                  <li>
                    GPA คือค่าเฉลี่ยแต้มเกรดของวิชาในกลุ่มนั้น ส่วน F และ W คือจำนวนคนที่ได้เกรดนั้น
                  </li>
                  <li>ช่อง – คือวิชานั้นไม่มีนิสิตในชั้นปีนั้น</li>
                  <li>
                    ช่องที่มีนิสิตได้เกรด A ถึง F ไม่ถึง 5 ที่นั่งไม่แสดงเกรดกลาง แสดงเป็นข้อความ
                    &ldquo;ข้อมูลยังน้อย&rdquo;
                  </li>
                  <li>
                    คอลัมน์ &ldquo;รวมวิชานี้&rdquo; รวมทุกชั้นปีของวิชา
                    และบอกเกรดที่พบมากที่สุดด้วย
                  </li>
                  <li>เรียงตามรหัสวิชา</li>
                </ul>
              </details>
              <YearLevelMatrix matrix={matrix} />
              {matrix.unplaced > 0 && (
                <p className="text-xs text-muted-foreground">
                  {matrix.unplaced} ที่นั่งหาชั้นปีไม่พบ จึงไม่อยู่ในตารางนี้
                </p>
              )}
            </PageSection>
          </Reveal>
        )}

        {ready && totalStudents > 0 && (
          <CollapsibleSection
            framed={false}
            title="รายชื่อนิสิตแต่ละชั้นปี"
            meta={
              <span className="text-sm font-normal text-muted-foreground">
                กดชั้นปีเพื่อดูรายชื่อ
              </span>
            }
          >
            <InstructorYearLevelOverview buckets={buckets} lowIds={lowIds} />
          </CollapsibleSection>
        )}
      </DashboardShell>
    </RequireRole>
  );
}
