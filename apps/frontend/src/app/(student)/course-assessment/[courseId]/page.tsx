'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ArrowLeft, Check } from 'lucide-react';
import { fetchOwnStudentProfile } from '@/lib/api/dashboard';
import { fetchCourses } from '@/lib/api/academic-record';
import {
  createAssessment,
  fetchClos,
  fetchOwnAssessment,
  updateAssessment,
} from '@/lib/api/course-assessment';
import {
  courseAssessmentSchema,
  type CourseAssessmentFormValues,
} from '@/lib/validation/course-assessment.schema';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Reveal } from '@/components/layout/reveal';
import { PageLoadError } from '@/components/layout/page-states';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListSkeleton, Skeleton } from '@/components/ui/skeleton';

// 0 = not chosen yet. Seeding every CLO with a middle score let the form be
// submitted untouched, recording answers the student never gave.
const UNSET_SCORE = 0;
const SELF_ASSESSMENT_LEVELS = [
  { score: 1, label: 'ยังไม่สามารถ' },
  { score: 2, label: 'เริ่มต้น' },
  { score: 3, label: 'ทำได้ตามความคาดหวัง' },
  { score: 4, label: 'ดี' },
  { score: 5, label: 'ดีเยี่ยม' },
] as const;

export default function CourseAssessmentPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ['student-profile-me'],
    queryFn: fetchOwnStudentProfile,
  });
  const coursesQuery = useQuery({ queryKey: ['courses'], queryFn: fetchCourses });
  const closQuery = useQuery({ queryKey: ['clos'], queryFn: fetchClos });
  const assessmentQuery = useQuery({
    queryKey: ['own-assessment', courseId],
    queryFn: () => fetchOwnAssessment(courseId),
  });

  const course = coursesQuery.data?.find((c) => c.id === courseId);
  // The API returns CLOs unordered; list them CLO1, CLO2, … CLO10.
  const clos = (closQuery.data ?? [])
    .filter((c) => c.courseId === courseId)
    .sort((a, b) => a.code.localeCompare(b.code, 'th', { numeric: true }));
  const existing = assessmentQuery.data;

  const form = useForm<CourseAssessmentFormValues>({
    resolver: zodResolver(courseAssessmentSchema),
    defaultValues: { cloScores: [], comment: '' },
  });
  const { fields, replace } = useFieldArray({ control: form.control, name: 'cloScores' });
  const watchedScores = form.watch('cloScores');
  const unansweredCount = watchedScores.filter((s) => !(s.score >= 1)).length;

  // Populate the (fixed) CLO rows once CLOs + any existing assessment have
  // loaded — not user-addable/removable, so useFieldArray is only used for
  // its stable field keys, replace() seeds it in one shot.
  useEffect(() => {
    if (clos.length === 0) return;
    replace(
      clos.map((clo) => {
        const existingScore = existing?.cloScores.find((s) => s.cloId === clo.id)?.score;
        return {
          cloId: clo.id,
          score: existingScore ?? UNSET_SCORE,
        };
      }),
    );
    if (existing?.comment) {
      form.setValue('comment', existing.comment);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clos.length, existing]);

  async function onSubmit(values: CourseAssessmentFormValues) {
    setServerError(null);
    try {
      if (existing) {
        await updateAssessment(existing.id, values);
      } else {
        await createAssessment({ courseId, ...values });
      }
      await queryClient.invalidateQueries({ queryKey: ['own-assessment', courseId] });
      await queryClient.invalidateQueries({ queryKey: ['own-assessments'] });
      await queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
      toast.success(existing ? 'บันทึกการแก้ไขการประเมินแล้ว' : 'บันทึกการประเมินแล้ว');
      router.push('/academic-record');
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 400) {
        setServerError('ไม่สามารถประเมินวิชานี้ได้ — ตรวจสอบว่าคุณลงเรียนวิชานี้แล้ว');
      } else if (isAxiosError(error) && error.response?.status === 409) {
        setServerError('คุณได้ประเมินวิชานี้ไปแล้ว');
      } else {
        setServerError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      }
    }
  }

  if (!user) return null;

  const isLoading =
    profileQuery.isLoading || coursesQuery.isLoading || closQuery.isLoading || assessmentQuery.isLoading;

  const skeleton = (
    <>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <ListSkeleton items={4} />
        </CardContent>
      </Card>
    </>
  );

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
    coursesQuery.isError ||
    closQuery.isError ||
    assessmentQuery.isError ||
    !course ||
    !profileQuery.data
  ) {
    return (
      <DashboardShell studentCode={profileQuery.data?.studentCode ?? ''} fullName={user.fullName}>
        <PageLoadError
          onRetry={() => {
            profileQuery.refetch();
            coursesQuery.refetch();
            closQuery.refetch();
            assessmentQuery.refetch();
          }}
        />
      </DashboardShell>
    );
  }

  if (clos.length === 0) {
    return (
      <DashboardShell studentCode={profileQuery.data.studentCode} fullName={user.fullName}>
        <Alert>
          <AlertDescription>วิชานี้ยังไม่มี CLO ให้ประเมิน</AlertDescription>
        </Alert>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      studentCode={profileQuery.data.studentCode}
      fullName={user.fullName}
      skeleton={skeleton}
    >
      <Link
        href="/academic-record"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={16} />
        กลับไปติดตามผลการเรียน
      </Link>
      <PageHeader
        title={existing ? 'แก้ไขการประเมินตนเอง' : 'ประเมินตนเองตาม CLO'}
        description={`${course.code}: ${course.name}`}
      />

      <Reveal index={1}>
        <Card>
          <CardHeader>
            <CardTitle>ให้คะแนนตัวเองในแต่ละ CLO</CardTitle>
          </CardHeader>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              {serverError && (
                <Alert variant="destructive">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}

              {fields.map((field, index) => {
                const clo = clos.find((c) => c.id === field.cloId)!;
                const currentScore = form.watch(`cloScores.${index}.score`);
                return (
                  <section
                    key={field.id}
                    className="space-y-3 border-t border-slate-100 pt-4 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-primary">{clo.code}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{clo.description}</p>
                      </div>
                      <span className="shrink-0 rounded-md bg-slate-50 px-2.5 py-1 text-sm font-medium text-primary">
                        {currentScore >= 1 ? `ระดับ ${currentScore}` : 'ยังไม่ได้เลือก'}
                      </span>
                    </div>
                    <div
                      role="radiogroup"
                      aria-label={`ระดับการประเมิน ${clo.code}`}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-5"
                    >
                      {SELF_ASSESSMENT_LEVELS.map((level) => {
                        const isSelected = currentScore === level.score;
                        return (
                          <Button
                            key={level.score}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            variant={isSelected ? 'default' : 'outline'}
                            className={`h-auto min-h-14 whitespace-normal border-slate-100 px-2 py-2 text-center ${
                              isSelected
                                ? 'shadow-sm ring-1 ring-primary/20'
                                : 'text-primary hover:border-slate-200'
                            }`}
                            onClick={() =>
                              form.setValue(`cloScores.${index}.score`, level.score, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                          >
                            <span className="flex flex-col items-center gap-0.5 leading-tight">
                              <span className="flex items-center gap-1 text-base font-semibold">
                                {isSelected && <Check aria-hidden="true" size={14} strokeWidth={2.5} />}
                                {level.score}
                              </span>
                              <span className="text-xs">{level.label}</span>
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              <div className="space-y-2">
                <label htmlFor="comment" className="text-sm font-medium text-primary">
                  ความคิดเห็นเพิ่มเติม (ถ้ามี)
                </label>
                <Textarea
                  id="comment"
                  {...form.register('comment')}
                  placeholder="แสดงความคิดเห็นเกี่ยวกับวิชานี้..."
                />
              </div>

              {unansweredCount > 0 && (
                <p className="text-sm text-amber-600">
                  ยังไม่ได้ให้คะแนน {unansweredCount} จาก {clos.length} CLO — เลือกให้ครบก่อนบันทึก
                </p>
              )}

              <Button type="submit" disabled={form.formState.isSubmitting || unansweredCount > 0}>
                {form.formState.isSubmitting
                  ? 'กำลังบันทึก...'
                  : existing
                    ? 'บันทึกการแก้ไข'
                    : 'บันทึกการประเมิน'}
              </Button>
            </CardContent>
          </form>
        </Card>
      </Reveal>
    </DashboardShell>
  );
}
