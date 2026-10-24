'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AvailableCourse, CourseSummary, IncompleteElectiveCategory } from '@eduanalyze-ai/shared-types';
import { cn } from '@/lib/utils';
import { saveMyLearningPathPlan } from '@/lib/api/learning-path';
import { isPlanDirty, planCoversGraduation, resolveInitialPlan } from '@/lib/learning-path-plan';
import { useToast } from '@/lib/toast-context';
import { Button } from '@/components/ui/button';
import { BADGE_TONE_CLASSES, TEXT_TONE_CLASSES } from '@/lib/tone';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CourseDragCard } from './course-drag-card';

type DropTarget = 'plan' | 'other';

export function DragDropPlanner({
  availableCourses,
  nextSemesterPlan,
  maxCreditsPerSemester,
  minCreditsWarning,
  savedPlanIds,
  graduationGap,
  onSaved,
  onDirtyChange,
}: Readonly<{
  availableCourses: AvailableCourse[];
  nextSemesterPlan: AvailableCourse[];
  maxCreditsPerSemester: number;
  minCreditsWarning: number;
  savedPlanIds: string[] | null;
  // What is still missing for the degree; null while unknown (never guessed).
  graduationGap: {
    creditsRemaining: number | null;
    missingRequiredCourses: CourseSummary[];
    incompleteElectiveCategories: IncompleteElectiveCategory[];
  } | null;
  onSaved: () => Promise<unknown> | void;
  onDirtyChange: (isDirty: boolean) => void;
}>) {
  const toast = useToast();
  const courseById = useMemo(() => {
    const map = new Map<string, AvailableCourse>();
    for (const course of [...nextSemesterPlan, ...availableCourses]) {
      map.set(course.courseId, course);
    }
    return map;
  }, [nextSemesterPlan, availableCourses]);

  // Seeded once on mount (saved plan, else the recommendation). Reset is done
  // by the page remounting this component (new `key`), and a background
  // refetch of the saved plan must never overwrite what the student is editing.
  const [initial] = useState(() =>
    resolveInitialPlan(
      savedPlanIds,
      availableCourses.map((c) => c.courseId),
      nextSemesterPlan.map((c) => c.courseId),
    ),
  );
  const [planIds, setPlanIds] = useState<string[]>(initial.planIds);
  const [baselineIds, setBaselineIds] = useState<string[]>(initial.planIds);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isDirty = isPlanDirty(baselineIds, planIds);
  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;

  useEffect(() => {
    onDirtyChangeRef.current(isDirty);
    return () => onDirtyChangeRef.current(false);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  async function savePlan() {
    setSaving(true);
    setSaveError(null);
    try {
      await saveMyLearningPathPlan({ courseIds: planIds });
      setBaselineIds(planIds);
      await onSaved();
      toast.success('บันทึกแผนเทอมหน้าแล้ว');
    } catch {
      setSaveError('บันทึกแผนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSaving(false);
    }
  }

  const planCourses = planIds.map((id) => courseById.get(id)).filter((c): c is AvailableCourse => !!c);
  const otherCourses = availableCourses.filter((c) => !planIds.includes(c.courseId));
  // A curriculum with the whole GE list has 200+ open courses: search, and scroll inside the box.
  const [otherQuery, setOtherQuery] = useState('');
  const otherNeedle = otherQuery.trim().toLowerCase();
  const shownOtherCourses = otherNeedle
    ? otherCourses.filter((c) => `${c.code} ${c.name}`.toLowerCase().includes(otherNeedle))
    : otherCourses;

  const totalCredits = planCourses.reduce((sum, c) => sum + c.credits, 0);
  const isOverLimit = totalCredits > maxCreditsPerSemester;
  const isBelowMin = totalCredits < minCreditsWarning;
  // A final-semester plan may legitimately be below the recommended minimum when it
  // already covers everything left for the degree, so the warning is dropped then.
  const coverage = graduationGap
    ? planCoversGraduation({
        planCourses,
        creditsRemaining: graduationGap.creditsRemaining,
        missingRequiredCourseIds: graduationGap.missingRequiredCourses.map((c) => c.courseId),
        incompleteCategories: graduationGap.incompleteElectiveCategories,
      })
    : 'unknown';
  const isCoveringPlan = isBelowMin && planCourses.length > 0 && coverage === 'covered';
  const isUnderMin = isBelowMin && !isCoveringPlan;

  // Which column is currently being dragged over, for the highlight
  // border/background below. A plain enter/leave state flickers because
  // dragenter/dragleave fire repeatedly as the pointer crosses child
  // elements (each CourseDragCard) inside the drop zone — the ref counter
  // tracks nesting depth per column so the highlight only clears once the
  // pointer has actually left the whole zone.
  const [dragOverTarget, setDragOverTarget] = useState<DropTarget | null>(null);
  const dragDepthRef = useRef<Record<DropTarget, number>>({ plan: 0, other: 0 });

  function moveToPlan(courseId: string) {
    setPlanIds((prev) => (prev.includes(courseId) ? prev : [...prev, courseId]));
  }

  function moveToOthers(courseId: string) {
    setPlanIds((prev) => prev.filter((id) => id !== courseId));
  }

  function handleDragEnter(target: DropTarget) {
    dragDepthRef.current[target] += 1;
    setDragOverTarget(target);
  }

  function handleDragLeave(target: DropTarget) {
    dragDepthRef.current[target] = Math.max(0, dragDepthRef.current[target] - 1);
    if (dragDepthRef.current[target] === 0) {
      setDragOverTarget((prev) => (prev === target ? null : prev));
    }
  }

  function handleDrop(e: React.DragEvent, target: DropTarget) {
    e.preventDefault();
    dragDepthRef.current[target] = 0;
    setDragOverTarget(null);
    const courseId = e.dataTransfer.getData('text/plain');
    if (!courseId) return;
    if (target === 'plan') moveToPlan(courseId);
    else moveToOthers(courseId);
  }

  // The "other" column is usually much longer than the plan, so on desktop
  // the plan column sticks while scrolling — a course near the bottom of
  // the list can then be dragged straight onto it. Its own max height keeps
  // an over-full plan scrollable instead of running off-screen.
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className={cn(
            'text-xs',
            saveError ? 'text-destructive' : 'text-muted-foreground',
          )}
          role={saveError ? 'alert' : undefined}
        >
          {saveError ??
            (isDirty
              ? 'มีการแก้ไขที่ยังไม่ได้บันทึก'
              : initial.droppedCount > 0
                ? `นำ ${initial.droppedCount} วิชาที่ลงไม่ได้แล้วออกจากแผนที่บันทึกไว้`
                : 'แผนตรงกับที่บันทึกไว้')}
        </p>
        <Button type="button" size="sm" onClick={savePlan} disabled={saving || !isDirty}>
          {saving ? 'กำลังบันทึก...' : 'บันทึกแผน'}
        </Button>
      </div>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <Card className="lg:sticky lg:top-6">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <CardTitle>วิชาในแผน ({planCourses.length})</CardTitle>
            <span
              className={cn(
                'text-sm font-medium tabular-nums',
                isOverLimit
                  ? TEXT_TONE_CLASSES.danger
                  : isUnderMin
                    ? TEXT_TONE_CLASSES.warning
                    : TEXT_TONE_CLASSES.success,
              )}
            >
              {totalCredits} / {maxCreditsPerSemester} หน่วยกิต
            </span>
          </div>
        </CardHeader>
        <CardContent
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={() => handleDragEnter('plan')}
          onDragLeave={() => handleDragLeave('plan')}
          onDrop={(e) => handleDrop(e, 'plan')}
          className={cn(
            'min-h-[120px] space-y-2 rounded-b-xl transition-colors lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto',
            dragOverTarget === 'plan' && 'bg-brand-light ring-2 ring-inset ring-brand',
          )}
        >
          {isOverLimit && (
            <p
              className={cn(
                'rounded-md border px-3 py-2 text-xs font-medium',
                BADGE_TONE_CLASSES.danger,
              )}
            >
              เกินหน่วยกิตสูงสุดต่อเทอม ({maxCreditsPerSemester} หน่วยกิต)
            </p>
          )}
          {isUnderMin && (
            <p
              className={cn(
                'rounded-md border px-3 py-2 text-xs font-medium',
                BADGE_TONE_CLASSES.warning,
              )}
            >
              ต่ำกว่าหน่วยกิตขั้นต่ำแนะนำ ({minCreditsWarning} หน่วยกิต)
            </p>
          )}
          {isCoveringPlan && (
            <p
              className={cn(
                'rounded-md border px-3 py-2 text-xs font-medium',
                BADGE_TONE_CLASSES.neutral,
              )}
            >
              แผนนี้ครอบคลุมหน่วยกิตที่เหลือเพื่อสำเร็จการศึกษา จึงต่ำกว่าขั้นต่ำแนะนำได้
            </p>
          )}
          {planCourses.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">ลากวิชามาวางที่นี่</p>
          )}
          {planCourses.map((course) => (
            <CourseDragCard
              key={course.courseId}
              course={course}
              moveLabel="เอาออกจากแผน"
              onMove={() => moveToOthers(course.courseId)}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>วิชาที่ลงได้อื่นๆ ({otherCourses.length})</CardTitle>
          {otherCourses.length > 0 && (
            <>
              <Input
                type="search"
                value={otherQuery}
                onChange={(e) => setOtherQuery(e.target.value)}
                placeholder="ค้นหารหัสหรือชื่อวิชา..."
                aria-label="ค้นหาวิชาที่ลงได้"
                className="h-11 text-base md:text-sm"
              />
              {otherNeedle && (
                <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
                  พบ {shownOtherCourses.length} จาก {otherCourses.length} วิชา
                </p>
              )}
            </>
          )}
        </CardHeader>
        <CardContent
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={() => handleDragEnter('other')}
          onDragLeave={() => handleDragLeave('other')}
          onDrop={(e) => handleDrop(e, 'other')}
          className={cn(
            'min-h-[120px] space-y-2 rounded-b-xl transition-colors',
            dragOverTarget === 'other' && 'bg-brand-light ring-2 ring-inset ring-brand',
          )}
        >
          {otherCourses.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">ไม่มีวิชาอื่นที่ลงได้ในขณะนี้</p>
          )}
          {otherNeedle && shownOtherCourses.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">ไม่พบวิชาที่ค้นหา</p>
          )}
          <div className="max-h-[36rem] space-y-2 overflow-y-auto pr-1">
            {shownOtherCourses.map((course) => (
              <CourseDragCard
                key={course.courseId}
                course={course}
                moveLabel="ย้ายเข้าแผน"
                onMove={() => moveToPlan(course.courseId)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
