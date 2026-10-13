'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { fetchOwnStudentProfile } from '@/lib/api/dashboard';
import { fetchCourses } from '@/lib/api/academic-record';
import { fetchCurriculum } from '@/lib/api/plo-achievement';
import {
  deleteMyLearningPathPlan,
  fetchLearningPath,
  fetchMyLearningPathPlan,
} from '@/lib/api/learning-path';
import { UNSAVED_PLAN_RESET_CONFIRM_MESSAGE } from '@/lib/learning-path-plan';
import { useConfirm } from '@/lib/use-confirm';
import { useToast } from '@/lib/toast-context';
import { fetchCreditCheck } from '@/lib/api/credit-checker';
import { fetchMyCreditLimitRequest } from '@/lib/api/credit-limit-request';
import { CREDIT_LIMIT_PRESETS, MIN_CREDITS_WARNING } from '@/lib/credit-limit-presets';
import { useAuth } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { Reveal } from '@/components/layout/reveal';
import { PageLoadError, StudentOnlyPage } from '@/components/layout/page-states';
import { CreditLimitRequestControl } from '@/components/learning-path/credit-limit-request-control';
import { DragDropPlanner } from '@/components/learning-path/drag-drop-planner';
import { ElectiveCategoryList } from '@/components/learning-path/elective-category-list';
import { LearningPathSkeleton } from '@/components/learning-path/learning-path-skeleton';
import { MissingRequiredSummary } from '@/components/learning-path/missing-required-summary';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function LearningPathPage() {
  return (
    <ProtectedRoute>
      <LearningPathContent />
    </ProtectedRoute>
  );
}

function LearningPathContent() {
  const { user } = useAuth();
  const isStudent = !!user?.roles.includes('STUDENT');
  const queryClient = useQueryClient();
  const toast = useToast();

  const profileQuery = useQuery({
    queryKey: ['student-profile-me'],
    queryFn: fetchOwnStudentProfile,
    enabled: isStudent,
  });
  const studentProfileId = profileQuery.data?.id;
  const curriculumId = profileQuery.data?.curriculumId;

  const pathQuery = useQuery({
    queryKey: ['learning-path', studentProfileId],
    queryFn: () => fetchLearningPath(studentProfileId!),
    enabled: !!studentProfileId,
  });
  const coursesQuery = useQuery({
    queryKey: ['courses'],
    queryFn: fetchCourses,
    enabled: !!studentProfileId,
  });
  const curriculumQuery = useQuery({
    queryKey: ['curriculum', curriculumId],
    queryFn: () => fetchCurriculum(curriculumId!),
    enabled: !!curriculumId,
  });
  const creditLimitRequestQuery = useQuery({
    queryKey: ['credit-limit-request-me'],
    queryFn: fetchMyCreditLimitRequest,
    enabled: !!studentProfileId,
  });

  // Only used to know how many credits remain for the degree; a failure just means
  // "unknown" (the planner then keeps its plain warning), so it never blocks the page.
  const creditCheckQuery = useQuery({
    queryKey: ['credit-check', studentProfileId],
    queryFn: () => fetchCreditCheck(studentProfileId!),
    enabled: !!studentProfileId,
  });

  const savedPlanQuery = useQuery({
    queryKey: ['learning-path-plan-me'],
    queryFn: fetchMyLearningPathPlan,
    enabled: !!studentProfileId,
  });

  // Bumping the key remounts the planner (re-seeding from the saved plan or
  // the recommendation) — the planner keeps its own state otherwise.
  const [plannerKey, setPlannerKey] = useState(0);
  const [plannerDirty, setPlannerDirty] = useState(false);
  const [resetting, setResetting] = useState(false);

  const { confirm, dialog } = useConfirm();

  async function resetPlan() {
    if (
      plannerDirty &&
      !(await confirm({
        title: 'รีเซ็ตแผนที่ยังไม่ได้บันทึก?',
        description: UNSAVED_PLAN_RESET_CONFIRM_MESSAGE,
        confirmLabel: 'รีเซ็ตแผน',
      }))
    ) {
      return;
    }
    setResetting(true);
    try {
      await deleteMyLearningPathPlan();
      // Wait for the refetch so the remounted planner seeds from "no saved plan".
      await queryClient.invalidateQueries({ queryKey: ['learning-path-plan-me'] });
      setPlannerKey((k) => k + 1);
    } catch {
      toast.error('รีเซ็ตแผนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setResetting(false);
    }
  }

  const courseCountByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const course of coursesQuery.data ?? []) {
      map.set(course.categoryId, (map.get(course.categoryId) ?? 0) + 1);
    }
    return map;
  }, [coursesQuery.data]);

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

  if (!isStudent) {
    return <StudentOnlyPage user={user} />;
  }

  const isLoading =
    profileQuery.isLoading ||
    pathQuery.isLoading ||
    coursesQuery.isLoading ||
    curriculumQuery.isLoading ||
    creditLimitRequestQuery.isLoading ||
    savedPlanQuery.isLoading;

  const skeleton = <LearningPathSkeleton />;

  if (isLoading) {
    return (
      <DashboardShell
        studentCode={profileQuery.data?.studentCode ?? ''}
        fullName={user.fullName}
        skeleton={skeleton}
        ready={false}
      >
        {null}
      </DashboardShell>
    );
  }

  if (
    profileQuery.isError ||
    pathQuery.isError ||
    coursesQuery.isError ||
    curriculumQuery.isError ||
    savedPlanQuery.isError ||
    !profileQuery.data ||
    !pathQuery.data ||
    !curriculumQuery.data
  ) {
    return (
      <DashboardShell studentCode={profileQuery.data?.studentCode ?? ''} fullName={user.fullName}>
        <PageLoadError
          onRetry={() => {
            profileQuery.refetch();
            pathQuery.refetch();
            coursesQuery.refetch();
            curriculumQuery.refetch();
            savedPlanQuery.refetch();
          }}
        />
      </DashboardShell>
    );
  }

  const path = pathQuery.data;
  const creditLimitRequest = creditLimitRequestQuery.data ?? null;
  const effectiveMaxCredits =
    creditLimitRequest?.type === 'EXCEED_MAX'
      ? (CREDIT_LIMIT_PRESETS.EXCEED_MAX.effectiveMax ?? curriculumQuery.data.maxCreditsPerSemester)
      : curriculumQuery.data.maxCreditsPerSemester;
  const effectiveMinCredits =
    creditLimitRequest?.type === 'BELOW_MIN'
      ? (CREDIT_LIMIT_PRESETS.BELOW_MIN.effectiveMin ?? MIN_CREDITS_WARNING)
      : MIN_CREDITS_WARNING;

  return (
    <DashboardShell
      studentCode={profileQuery.data.studentCode}
      fullName={user.fullName}
      skeleton={skeleton}
    >
      <PageHeader
        title="แผนการเรียน"
        description="แนะนำวิชาที่ควรเรียนต่อ ตามผลการเรียนและวิชาที่ต้องผ่านก่อน (Prerequisite) ของคุณ"
      />

      <Reveal index={1}>
        <PageSection
          title="จัดแผนเทอมหน้า"
          description={`ระบบจัดแผนที่แนะนำไว้ให้แล้ว — ลากวิชาหรือกดปุ่มย้ายเพื่อปรับ (${effectiveMinCredits}-${effectiveMaxCredits} หน่วยกิตต่อเทอม)`}
          actions={
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={resetting}
                onClick={resetPlan}
              >
                <RotateCcw size={14} aria-hidden="true" />
                รีเซ็ตเป็นแผนที่แนะนำ
              </Button>
              <CreditLimitRequestControl
                request={creditLimitRequest}
                onChanged={() =>
                  queryClient.invalidateQueries({ queryKey: ['credit-limit-request-me'] })
                }
              />
            </div>
          }
        >
          <DragDropPlanner
            key={plannerKey}
            availableCourses={path.availableCourses}
            nextSemesterPlan={path.nextSemesterPlan}
            maxCreditsPerSemester={effectiveMaxCredits}
            minCreditsWarning={effectiveMinCredits}
            savedPlanIds={savedPlanQuery.data?.courseIds ?? null}
            graduationGap={
              creditCheckQuery.data
                ? {
                    creditsRemaining: creditCheckQuery.data.creditsRemaining,
                    missingRequiredCourses: path.missingRequiredCourses,
                    incompleteElectiveCategories: path.incompleteElectiveCategories,
                  }
                : null
            }
            onSaved={() => queryClient.invalidateQueries({ queryKey: ['learning-path-plan-me'] })}
            onDirtyChange={setPlannerDirty}
          />
        </PageSection>
      </Reveal>

      <Reveal index={2}>
        <PageSection
          title="สิ่งที่ยังขาดก่อนจบ"
          description="วิชาบังคับและหมวดวิชาเลือกที่ยังไม่ครบตามหลักสูตร"
        >
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
            {/* Wrapper keeps StatCard's h-full from stretching to the elective list's height. */}
            <div>
              <MissingRequiredSummary
                courses={path.missingRequiredCourses}
                readiness={path.graduationReadiness}
              />
            </div>
            <div className="lg:col-span-2">
              <ElectiveCategoryList
                categories={path.incompleteElectiveCategories}
                courseCountByCategory={courseCountByCategory}
              />
            </div>
          </div>
        </PageSection>
      </Reveal>
      {dialog}
    </DashboardShell>
  );
}
