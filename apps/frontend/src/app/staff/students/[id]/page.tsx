'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { AlertTriangle, ArrowLeft, Ban, Check, Pencil, Plus, Star } from 'lucide-react';
import {
  fetchAcademicYears,
  fetchCourses,
  fetchMyGpa,
  fetchSemesters,
} from '@/lib/api/academic-record';
import {
  fetchCourseRecordsInScope,
  fetchInstructorsInScope,
  fetchStaffOverview,
  fetchStaffStudentRisk,
  fetchStudentAuditLogs,
  fetchStudentProfile,
} from '@/lib/api/staff';
import { fetchCurricula, fetchPrograms } from '@/lib/api/organization';
import { formatSemesterLabel } from '@/lib/grade-label';
import { useAuth } from '@/lib/auth-context';
import { ROLE_LABEL_TH } from '@/components/auth/require-role';
import { useToast } from '@/lib/toast-context';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-states';
import { PageSection } from '@/components/layout/page-section';
import { Reveal } from '@/components/layout/reveal';
import { GpaScale } from '@/components/ui/gpa-scale';
import { MetricCard } from '@/components/staff/metric-card';
import {
  GRADE_SAVES_NOW_DETAIL,
  GRADE_SAVES_NOW_NOTICE,
  recordModeView,
} from '@/components/staff/record-edit-mode';
import { StaffAddRecordForm } from '@/components/staff/staff-add-record-form';
import { StaffRecordList } from '@/components/staff/staff-record-list';
import { staffStatus } from '@/components/staff/staff-status';
import { StatusBadge } from '@/components/staff/status-badge';
import { isStudentSuspended } from '@/components/staff/student-account';
import { StudentAccountStatusControl } from '@/components/staff/student-account-status-control';
import { StudentAdvisorSheet } from '@/components/staff/student-advisor-sheet';
import { StudentHistorySection } from '@/components/staff/student-history-section';
import { StudentProfileEditForm } from '@/components/staff/student-profile-edit-form';
import { NO_ADVISOR_LABEL, type AuditLabelLookups } from '@/components/staff/describe-audit-entry';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NO_DATA_LABEL } from '@/components/staff/student-reading';
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton';
import { BADGE_TONE_CLASSES, type SemanticTone } from '@/lib/tone';
import { cn } from '@/lib/utils';

// Colour of the GPA track: follows the student's status, grey when there is none.
const STATUS_TONE: Record<string, SemanticTone> = {
  CRITICAL: 'danger',
  WATCH: 'warning',
  NORMAL: 'success',
};

const TERM_ORDER: Record<string, number> = { FIRST: 0, SECOND: 1, SUMMER: 2 };

export default function StaffStudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <StaffStudentDetailContent studentProfileId={id} />;
}

function StaffStudentDetailContent({ studentProfileId }: { studentProfileId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  // Viewing is the default; nothing on the page can write until editing is turned on.
  const [editing, setEditing] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const mode = recordModeView(editing);

  const profileQuery = useQuery({
    queryKey: ['staff-student', studentProfileId],
    queryFn: () => fetchStudentProfile(studentProfileId),
  });
  const gpaQuery = useQuery({
    queryKey: ['staff-student-gpa', studentProfileId],
    queryFn: () => fetchMyGpa(studentProfileId),
  });
  const recordsQuery = useQuery({
    queryKey: ['staff-course-records'],
    queryFn: fetchCourseRecordsInScope,
  });
  // Same query key the directory list page uses — resolves from cache when
  // arriving via a "ดูรายละเอียด" link, and gives this page a risk level
  // without a dedicated per-student endpoint.
  const riskQuery = useQuery({
    queryKey: ['staff-student-risk'],
    queryFn: fetchStaffStudentRisk,
  });
  const coursesQuery = useQuery({
    queryKey: ['courses'],
    queryFn: fetchCourses,
  });
  const academicYearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: fetchAcademicYears,
  });
  const semestersQuery = useQuery({
    queryKey: ['semesters'],
    queryFn: fetchSemesters,
  });
  const programsQuery = useQuery({
    queryKey: ['programs'],
    queryFn: fetchPrograms,
  });
  const curriculaQuery = useQuery({
    queryKey: ['curricula'],
    queryFn: fetchCurricula,
  });
  const auditQuery = useQuery({
    queryKey: ['staff-student-audit', studentProfileId],
    queryFn: () => fetchStudentAuditLogs(studentProfileId),
  });
  // Who can be picked as advisor, and the names the history shows for advisor ids.
  const instructorsQuery = useQuery({
    queryKey: ['instructors-in-scope'],
    queryFn: fetchInstructorsInScope,
  });
  // The requester's own programs and their curricula: what the edit form offers.
  const overviewQuery = useQuery({
    queryKey: ['staff-overview'],
    queryFn: fetchStaffOverview,
  });

  const courseMap = useMemo(
    () => new Map((coursesQuery.data ?? []).map((c) => [c.id, c])),
    [coursesQuery.data],
  );
  const yearById = useMemo(
    () => new Map((academicYearsQuery.data ?? []).map((y) => [y.id, y.year])),
    [academicYearsQuery.data],
  );
  const joinedSemesters = useMemo(() => {
    return (semestersQuery.data ?? [])
      .map((s) => ({
        id: s.id,
        year: yearById.get(s.academicYearId),
        term: s.term,
        label: formatSemesterLabel(s.term, yearById.get(s.academicYearId)),
      }))
      .sort((a, b) => {
        const yearDiff = (b.year ?? 0) - (a.year ?? 0);
        if (yearDiff !== 0) return yearDiff;
        return TERM_ORDER[b.term] - TERM_ORDER[a.term];
      });
  }, [semestersQuery.data, yearById]);
  const semesterMap = useMemo(
    () => new Map(joinedSemesters.map((s, order) => [s.id, { label: s.label, order }])),
    [joinedSemesters],
  );

  const profile = profileQuery.data;
  const filteredCourses = useMemo(() => {
    if (!profile) return [];
    return (coursesQuery.data ?? [])
      .filter((c) => c.curriculumId === profile.curriculumId)
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [coursesQuery.data, profile]);
  const ownRecords = (recordsQuery.data ?? []).filter(
    (r) => r.studentProfileId === studentProfileId,
  );

  function handleRecordCreated() {
    toast.success('เพิ่มรายวิชาแล้ว');
    setShowAddForm(false);
    refetchRecords();
  }

  function refetchRecords() {
    queryClient.invalidateQueries({ queryKey: ['staff-course-records'] });
    queryClient.invalidateQueries({
      queryKey: ['staff-student-gpa', studentProfileId],
    });
    queryClient.invalidateQueries({ queryKey: ['staff-student-audit', studentProfileId] });
  }

  // After a suspension, reactivation or profile edit: the student, the
  // directory status and the program counts all move.
  function refetchAccount() {
    queryClient.invalidateQueries({ queryKey: ['staff-student', studentProfileId] });
    queryClient.invalidateQueries({ queryKey: ['staff-student-risk'] });
    queryClient.invalidateQueries({ queryKey: ['staff-student-audit', studentProfileId] });
    queryClient.invalidateQueries({ queryKey: ['staff-overview'] });
  }

  function handleProfileSaved() {
    toast.success('บันทึกข้อมูลนิสิตแล้ว');
    setEditingProfile(false);
    refetchAccount();
  }

  const auditLabels: AuditLabelLookups = {
    course: (id) => {
      const course = courseMap.get(id);
      return course && `${course.code} ${course.name}`;
    },
    semester: (id) => semesterMap.get(id)?.label,
    program: (id) => programsQuery.data?.find((p) => p.id === id)?.code,
    curriculum: (id) => curriculaQuery.data?.find((c) => c.id === id)?.version,
    advisor: (id) =>
      instructorsQuery.data?.find((i) => i.id === id)?.fullName ??
      (profile?.advisor?.id === id ? profile.advisor.fullName : undefined),
    role: (role) => ROLE_LABEL_TH[role],
  };

  if (!user) return null;

  const forbidden = isAxiosError(profileQuery.error) && profileQuery.error.response?.status === 403;
  const program = programsQuery.data?.find((p) => p.id === profile?.programId);
  const curriculum = curriculaQuery.data?.find((c) => c.id === profile?.curriculumId);
  const gpa = gpaQuery.data;
  const risk = riskQuery.data?.find((s) => s.studentProfileId === studentProfileId);
  const suspended = profile ? isStudentSuspended(profile) : false;

  return (
    <DashboardShell role="STAFF" identityLabel={user.email} fullName={user.fullName}>
      <Link
        href="/staff/students"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={14} />
        กลับไปทำเนียบนิสิต
      </Link>

      {profileQuery.isLoading && (
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>ข้อมูลนิสิต</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>GPA สะสม</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-4 w-28" />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardContent className="pt-6">
              <TableSkeleton cols={5} rows={4} />
            </CardContent>
          </Card>
        </div>
      )}
      {forbidden && (
        <PageLoadError
          message="ไม่มีสิทธิ์เข้าถึงนิสิตคนนี้"
          onRetry={() => profileQuery.refetch()}
        />
      )}
      {profileQuery.isError && !forbidden && (
        <PageLoadError message="ไม่พบนิสิต" onRetry={() => profileQuery.refetch()} />
      )}

      {profile && (
        <>
          <Reveal index={0}>
            <PageHeader
              title={profile.user.fullName}
              description={`${profile.studentCode} · ${profile.user.email}`}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  {risk && <StatusBadge status={staffStatus(risk)} />}
                  <StudentAccountStatusControl profile={profile} onChanged={refetchAccount} />
                </div>
              }
            />
            {suspended && (
              <p
                role="note"
                className={cn(
                  'mt-3 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm',
                  BADGE_TONE_CLASSES.neutral,
                )}
              >
                <Ban aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  บัญชีนี้ถูกระงับ นิสิตเข้าสู่ระบบไม่ได้ ดูข้อมูลได้อย่างเดียว
                  ถ้าจะแก้ผลการเรียนหรือข้อมูลนิสิต ให้เปิดบัญชีอีกครั้งก่อน
                </span>
              </p>
            )}
            {risk && risk.lowGradeCount > 0 && (
              <p
                role="note"
                className={cn(
                  'mt-3 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm',
                  BADGE_TONE_CLASSES.warning,
                )}
              >
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  มีรายวิชา D+/D/F/U อยู่{' '}
                  <span className="font-semibold tabular-nums">{risk.lowGradeCount}</span> วิชา
                  ควรติดตามผลการเรียนของนิสิต
                </span>
              </p>
            )}
          </Reveal>

          <Reveal index={1} className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="flex h-full flex-col md:col-span-2">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                <CardTitle>ข้อมูลนิสิต</CardTitle>
                {!suspended && !editingProfile && (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1.5 px-4"
                    onClick={() => setEditingProfile(true)}
                  >
                    <Pencil aria-hidden="true" size={16} />
                    แก้ไขข้อมูล
                  </Button>
                )}
              </CardHeader>
              <CardContent className="flex-1">
                <dl className="grid h-full grid-cols-1 content-evenly gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">สาขา</dt>
                    <dd className="break-words text-primary">{program?.name ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">ฉบับหลักสูตร</dt>
                    <dd className="text-primary">{curriculum?.version ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">ปีเข้าศึกษา</dt>
                    <dd className="tabular-nums text-primary">{profile.admissionYear}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">รหัสนิสิต</dt>
                    <dd className="tabular-nums text-primary">{profile.studentCode}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">อีเมล</dt>
                    <dd className="break-all text-primary">{profile.user.email}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">อาจารย์ที่ปรึกษา</dt>
                    <dd className="flex flex-wrap items-center gap-x-2 text-primary">
                      <span
                        className={cn('break-words', !profile.advisor && 'text-muted-foreground')}
                      >
                        {profile.advisor?.fullName ?? NO_ADVISOR_LABEL}
                      </span>
                      {!suspended && (
                        <Button
                          type="button"
                          variant="link"
                          className="h-11 px-0 text-brand underline"
                          aria-label={
                            profile.advisor ? 'เปลี่ยนอาจารย์ที่ปรึกษา' : 'กำหนดอาจารย์ที่ปรึกษา'
                          }
                          onClick={() => setAdvisorOpen(true)}
                        >
                          {profile.advisor ? 'เปลี่ยน' : 'กำหนด'}
                        </Button>
                      )}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {gpa ? (
              <MetricCard
                icon={Star}
                label="GPA สะสม"
                value={
                  gpa.gpa !== null ? (
                    <AnimatedNumber value={gpa.gpa} decimals={2} format={(n) => n.toFixed(2)} />
                  ) : (
                    NO_DATA_LABEL
                  )
                }
                unit={gpa.gpa !== null ? '/ 4.00' : undefined}
                footer={
                  <div className="space-y-2">
                    {risk && <StatusBadge status={staffStatus(risk)} />}
                    <GpaScale
                      gpa={gpa.gpa}
                      tone={risk ? (STATUS_TONE[staffStatus(risk)] ?? 'neutral') : 'neutral'}
                    />
                  </div>
                }
                note={`${gpa.creditsCounted} หน่วยกิตที่นับ GPA`}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>GPA สะสม</CardTitle>
                </CardHeader>
                <CardContent>
                  {gpaQuery.isLoading ? (
                    <Skeleton className="h-9 w-20" />
                  ) : (
                    <p className="text-sm text-muted-foreground">{NO_DATA_LABEL}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </Reveal>

          <StudentAdvisorSheet
            open={advisorOpen && !suspended}
            studentProfileId={studentProfileId}
            studentName={`${profile.studentCode} ${profile.user.fullName}`}
            current={profile.advisor}
            instructors={instructorsQuery.data ?? []}
            onClose={() => setAdvisorOpen(false)}
            onChanged={refetchAccount}
          />

          {editingProfile && !suspended && (
            <StudentProfileEditForm
              profile={profile}
              programs={overviewQuery.data?.programs ?? []}
              onSaved={handleProfileSaved}
              onCancel={() => setEditingProfile(false)}
            />
          )}

          <Reveal index={2}>
            <PageSection
              title="ผลการเรียนรายวิชา"
              actions={
                !suspended &&
                (editing ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={showAddForm ? 'outline' : 'default'}
                      className="gap-1.5 px-4"
                      onClick={() => setShowAddForm((open) => !open)}
                    >
                      {showAddForm ? (
                        'ยกเลิกการเพิ่ม'
                      ) : (
                        <>
                          <Plus aria-hidden="true" size={16} />
                          เพิ่มรายวิชา
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-1.5 px-4"
                      onClick={() => {
                        setEditing(false);
                        setShowAddForm(false);
                      }}
                    >
                      <Check aria-hidden="true" size={16} />
                      เสร็จสิ้น
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1.5 px-4"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil aria-hidden="true" size={16} />
                    แก้ไขผลการเรียน
                  </Button>
                ))
              }
            >
              {mode.showNotice && (
                <p
                  role="note"
                  className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
                >
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <span className="font-semibold">{GRADE_SAVES_NOW_NOTICE}</span>{' '}
                    {GRADE_SAVES_NOW_DETAIL} · การเพิ่มและการลบรายวิชาก็บันทึกทันทีเช่นกัน
                  </span>
                </p>
              )}
              {mode.showAddCourse && showAddForm && (
                <StaffAddRecordForm
                  studentProfileId={studentProfileId}
                  courses={filteredCourses}
                  semesterOptions={joinedSemesters}
                  onCreated={handleRecordCreated}
                  onCancel={() => setShowAddForm(false)}
                />
              )}

              <Card>
                <CardHeader>
                  <CardTitle>รายวิชาที่บันทึกไว้</CardTitle>
                </CardHeader>
                <CardContent>
                  <StaffRecordList
                    records={ownRecords}
                    courseMap={courseMap}
                    semesterMap={semesterMap}
                    editing={editing && !suspended}
                    onChanged={refetchRecords}
                  />
                </CardContent>
              </Card>
            </PageSection>
          </Reveal>

          <Reveal index={3}>
            <StudentHistorySection
              entries={auditQuery.data}
              loading={auditQuery.isLoading}
              failed={auditQuery.isError}
              onRetry={() => auditQuery.refetch()}
              labels={auditLabels}
            />
          </Reveal>
        </>
      )}
    </DashboardShell>
  );
}
