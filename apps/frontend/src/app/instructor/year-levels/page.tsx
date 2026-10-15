'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { AlertTriangle, Info, Table2, TrendingDown, Users } from 'lucide-react';
import {
  useInstructorDashboard,
  useInstructorStudents,
  useInstructorYearLevels,
} from '@/lib/instructor-queries';
import { buildCourseOverviews, buildCourseYearMatrix } from '@/lib/instructor-overview';
import { buildYearLevelsFigures, lowGradeIds } from '@/lib/student-directory';
import { LOW_GRADE_LABEL, LOW_GRADE_RULE } from '@/lib/low-grade';
import { useAuth } from '@/lib/auth-context';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { YearLevelMatrix } from '@/components/instructor/year-level-matrix';
import { InstructorYearLevelOverview } from '@/components/instructor/instructor-year-level-overview';
import { TEXT_PAGE, TEXT_SECTION } from '@/components/instructor/instructor-ui';
import { CollapsibleCard, SectionCard } from '@/components/instructor/section-card';
import { StatCard } from '@/components/dashboard/stat-card';
import { Progress } from '@/components/ui/progress';
import { BAR_TONE_CLASSES, type SemanticTone } from '@/lib/tone';
import { formatPercent } from '@/lib/format-percent';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { PageHeader } from '@/components/layout/page-header';
import { Reveal } from '@/components/layout/reveal';
import { ApiErrorAlert } from '@/components/ui/api-error-alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCardsSkeleton } from '@/components/ui/skeleton';
import { PageSection } from '@/components/layout/page-section';

// At or above this share of the students, a count is shown as danger, not warning.
const HIGH_SHARE_PERCENT = 25;

// "x% of all students" as a thin bar and one line of words.
function ShareFooter({
  count,
  total,
  tone,
  note,
}: Readonly<{ count: number; total: number; tone: SemanticTone; note: string }>) {
  const percent = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <Progress
        value={percent}
        label={`${formatPercent(percent)} ของนิสิตทั้งหมด`}
        className="h-1"
        barClassName={BAR_TONE_CLASSES[tone]}
      />
      <p className="truncate text-xs text-muted-foreground" title={`${note}`}>
        <span className="font-semibold tabular-nums text-primary">{formatPercent(percent)}</span>{' '}
        ของนิสิตทั้งหมด · {note}
      </p>
    </div>
  );
}

export default function InstructorYearLevelsPage() {
  return <InstructorYearLevelsContent />;
}

function InstructorYearLevelsContent() {
  const { user } = useAuth();
  const isInstructor = !!user?.roles.includes('INSTRUCTOR');

  const query = useInstructorYearLevels({ enabled: isInstructor });
  // Same key as the students page, so the two share one cache entry. Year
  // levels carry no grades of their own; this supplies them per student.
  const studentsQuery = useInstructorStudents({ enabled: isInstructor });

  // Same key as the dashboard: the per-course grade tally and the goal of each course.
  const dashboardQuery = useInstructorDashboard({ enabled: isInstructor });
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
  // All three requests feed this page; name the ones that failed and retry only those.
  const failedLoads = [
    { failed: query.isError, label: 'ชั้นปีของนิสิต', refetch: query.refetch },
    { failed: studentsQuery.isError, label: 'ผลการเรียนรายนิสิต', refetch: studentsQuery.refetch },
    { failed: dashboardQuery.isError, label: 'รายวิชาที่สอน', refetch: dashboardQuery.refetch },
  ].filter((l) => l.failed);
  const figures = ready ? buildYearLevelsFigures(buckets, lowIds) : null;
  const lowShare =
    figures && figures.lowGrade !== null && figures.total > 0
      ? (figures.lowGrade / figures.total) * 100
      : 0;
  const lowTone: SemanticTone =
    !figures || !figures.lowGrade
      ? 'neutral'
      : lowShare >= HIGH_SHARE_PERCENT
        ? 'danger'
        : 'warning';

  // The layout's guard renders nothing below it until the user is known.
  if (!user) return null;

  return (
    <DashboardShell role="INSTRUCTOR" identityLabel={user.email} fullName={user.fullName}>
      <div className="space-y-6">
        <Reveal index={0}>
          <PageHeader
            title="ภาพรวมชั้นปี"
            description="นิสิตที่เคยเรียนวิชาของคุณ แบ่งตามชั้นปี (ไม่รวมนิสิตทั้งหลักสูตร)"
            titleClassName={TEXT_PAGE}
          />
        </Reveal>

        {(query.isLoading || (!!query.data && !ready)) && (
          <StatCardsSkeleton count={3} className="sm:grid-cols-3" />
        )}

        {failedLoads.length > 0 && (
          <ApiErrorAlert
            message={`ไม่สามารถโหลดข้อมูล${failedLoads.map((l) => l.label).join(' และ ')}ได้ กรุณาลองใหม่อีกครั้ง`}
            onRetry={() => failedLoads.forEach((l) => void l.refetch())}
          />
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
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                dense
                icon={Users}
                tone="primary"
                interactive={false}
                label="นิสิต"
                value={<AnimatedNumber value={figures.total} />}
                suffix="คน"
                footer={<p className="text-xs text-muted-foreground">ที่เคยเรียนวิชาของคุณ</p>}
              />
              <StatCard
                dense
                icon={AlertTriangle}
                tone={lowTone}
                interactive={false}
                label={`${LOW_GRADE_LABEL}ในวิชาของคุณ`}
                value={
                  figures.lowGrade === null ? '—' : <AnimatedNumber value={figures.lowGrade} />
                }
                suffix={figures.lowGrade === null ? undefined : 'คน'}
                footer={
                  figures.lowGrade === null ? (
                    <p className="text-xs text-muted-foreground">โหลดข้อมูลรายวิชาไม่ได้</p>
                  ) : (
                    <ShareFooter
                      count={figures.lowGrade}
                      total={figures.total}
                      tone={lowTone}
                      note={LOW_GRADE_RULE}
                    />
                  )
                }
              />
              <StatCard
                dense
                icon={TrendingDown}
                tone={figures.behind > 0 ? 'warning' : 'neutral'}
                interactive={false}
                label="หน่วยกิตน้อยกว่าที่ควรมี"
                value={<AnimatedNumber value={figures.behind} />}
                suffix="คน"
                footer={
                  <ShareFooter
                    count={figures.behind}
                    total={figures.total}
                    tone={figures.behind > 0 ? 'warning' : 'neutral'}
                    note="เทียบกับแผนตามชั้นปี"
                  />
                }
              />
            </div>
          </Reveal>
        )}

        {ready && totalStudents > 0 && (
          <Reveal index={2}>
            <PageSection
              title="รายชื่อนิสิตแต่ละชั้นปี"
              titleClassName={TEXT_SECTION}
              description="กดชั้นปีเพื่อดูรายชื่อ ชั้นปีที่ไม่มีนิสิตจะกดไม่ได้"
            >
              <InstructorYearLevelOverview buckets={buckets} lowIds={lowIds} />
            </PageSection>
          </Reveal>
        )}

        {ready && totalStudents > 0 && matrix && matrix.levels.length > 0 && (
          <Reveal index={3}>
            <div className="space-y-4">
              <SectionCard
                icon={Table2}
                title="เกรดกลาง แยกตามวิชาและชั้นปี"
                description="นับเป็นการลงทะเบียน (นับต่อวิชา) กดที่วิชาเพื่อดูรายละเอียด"
                flush
                footer={
                  matrix.unplaced > 0 ? (
                    <p>การลงทะเบียน {matrix.unplaced} รายการ หาชั้นปีไม่พบ จึงไม่อยู่ในตารางนี้</p>
                  ) : undefined
                }
              >
                <YearLevelMatrix matrix={matrix} />
              </SectionCard>
              <CollapsibleCard icon={Info} tone="neutral" title="วิธีอ่านตาราง">
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>
                    <span className="font-medium text-primary">การลงทะเบียน (นับต่อวิชา)</span>{' '}
                    คือจำนวนรายการของนิสิตที่เรียนวิชานั้น นิสิตที่เรียนหลายวิชาจึงถูกนับในแต่ละวิชา
                  </li>
                  <li>
                    เกรดกลางของกลุ่มแสดงเป็นป้าย สีตาม GPA ของกลุ่ม: แดง ต่ำกว่า 1.50 เหลือง
                    1.50–1.74 เขียว 1.75 ขึ้นไป
                  </li>
                  <li>
                    GPA คือค่าเฉลี่ยแต้มเกรดของวิชาในกลุ่มนั้น ส่วน F คือจำนวนคนที่ได้เกรดนั้น
                  </li>
                  <li>ช่อง – คือวิชานั้นไม่มีนิสิตในชั้นปีนั้น</li>
                  <li>
                    ช่องที่มีการลงทะเบียนซึ่งได้เกรด A ถึง F ไม่ถึง 5 รายการ ไม่แสดงเกรดกลาง
                    แสดงเป็นข้อความ &ldquo;ข้อมูลยังน้อย&rdquo;
                  </li>
                  <li>
                    คอลัมน์ &ldquo;รวมวิชานี้&rdquo; รวมทุกชั้นปีของวิชา
                    และบอกเกรดที่พบมากที่สุดด้วย
                  </li>
                  <li>เรียงตามรหัสวิชา</li>
                </ul>
              </CollapsibleCard>
            </div>
          </Reveal>
        )}
      </div>
    </DashboardShell>
  );
}
