'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Building2,
  CalendarDays,
  GraduationCap,
  Hash,
  Landmark,
  Mail,
  type LucideIcon,
} from 'lucide-react';
import type {
  CurriculumListItem,
  DepartmentListItem,
  FacultyListItem,
  ProgramListItem,
  StudentProfileMeResponse,
} from '@eduanalyze-ai/shared-types';
import { fetchOwnStudentProfile } from '@/lib/api/dashboard';
import {
  fetchCurricula,
  fetchDepartments,
  fetchFaculties,
  fetchPrograms,
} from '@/lib/api/organization';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { AccountSecurityCard } from '@/components/profile/account-security-card';
import { primaryRoleFor, ROLE_LABEL_TH } from '@/components/auth/require-role';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-states';
import { Reveal } from '@/components/layout/reveal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileSkeleton } from '@/components/profile/profile-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}

function ProfileItem({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 items-start gap-3 py-1', className)}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand">
        <Icon size={17} aria-hidden="true" />
      </div>
      <div className="min-w-0 space-y-0.5 pt-0.5">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-semibold leading-5 text-primary">{value}</p>
      </div>
    </div>
  );
}

function ProfileEducationCard({
  profile,
  faculties,
  departments,
  programs,
  curricula,
}: {
  profile: StudentProfileMeResponse;
  faculties: FacultyListItem[];
  departments: DepartmentListItem[];
  programs: ProgramListItem[];
  curricula: CurriculumListItem[];
}) {
  const program = programs.find((p) => p.id === profile.programId);
  const department = program ? departments.find((d) => d.id === program.departmentId) : undefined;
  const faculty = department ? faculties.find((f) => f.id === department.facultyId) : undefined;
  const curriculum = curricula.find((c) => c.id === profile.curriculumId);

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardHeader className="flex-row items-center gap-3 space-y-0 pb-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand">
          <GraduationCap size={20} aria-hidden="true" />
        </div>
        <div>
          <CardTitle className="text-lg text-primary">ข้อมูลการศึกษา</CardTitle>
          <CardDescription className="mt-1">หลักสูตรและหน่วยงานการศึกษาปัจจุบัน</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
        <ProfileItem icon={Landmark} label="คณะ" value={faculty?.name ?? '—'} />
        <ProfileItem icon={Building2} label="ภาควิชา" value={department?.name ?? '—'} />
        <ProfileItem icon={GraduationCap} label="สาขา" value={program?.name ?? '—'} />
        <ProfileItem
          icon={BookOpen}
          label="หลักสูตร"
          value={curriculum ? `${curriculum.version} (พ.ศ. ${curriculum.effectiveYear})` : '—'}
        />
        <ProfileItem
          icon={CalendarDays}
          label="ปีที่เข้าศึกษา"
          value={`${profile.admissionYear}`}
        />
      </CardContent>
    </Card>
  );
}

function ProfileContent() {
  const { user } = useAuth();
  const isStudent = !!user?.roles.includes('STUDENT');

  const profileQuery = useQuery({
    queryKey: ['student-profile-me'],
    queryFn: fetchOwnStudentProfile,
    enabled: isStudent,
  });
  const facultiesQuery = useQuery({ queryKey: ['faculties'], queryFn: fetchFaculties, enabled: isStudent });
  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
    enabled: isStudent,
  });
  const programsQuery = useQuery({ queryKey: ['programs'], queryFn: fetchPrograms, enabled: isStudent });
  const curriculaQuery = useQuery({ queryKey: ['curricula'], queryFn: fetchCurricula, enabled: isStudent });

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

  const primaryRole = primaryRoleFor(user.roles);

  const isLoading =
    isStudent &&
    (profileQuery.isLoading ||
      facultiesQuery.isLoading ||
      departmentsQuery.isLoading ||
      programsQuery.isLoading ||
      curriculaQuery.isLoading);

  const skeleton = <ProfileSkeleton />;

  if (isLoading) {
    return (
      <DashboardShell
        role={primaryRole}
        identityLabel={user.email}
        fullName={user.fullName}
        skeleton={skeleton}
        ready={false}
      >
        {null}
      </DashboardShell>
    );
  }

  const hasError =
    isStudent &&
    (profileQuery.isError ||
      facultiesQuery.isError ||
      departmentsQuery.isError ||
      programsQuery.isError ||
      curriculaQuery.isError ||
      !profileQuery.data);

  if (hasError) {
    return (
      <DashboardShell role={primaryRole} identityLabel={user.email} fullName={user.fullName}>
        <PageLoadError
          onRetry={() => {
            profileQuery.refetch();
            facultiesQuery.refetch();
            departmentsQuery.refetch();
            programsQuery.refetch();
            curriculaQuery.refetch();
          }}
        />
      </DashboardShell>
    );
  }

  const initial = user.fullName.trim().charAt(0).toUpperCase();
  const identityLabel = isStudent ? profileQuery.data?.studentCode : user.email;

  return (
    <DashboardShell
      role={primaryRole}
      identityLabel={identityLabel}
      fullName={user.fullName}
      skeleton={skeleton}
    >
      <Reveal index={0}>
        <PageHeader title="ข้อมูลส่วนตัว" />
      </Reveal>

      <Reveal index={1}>
        <Card className="border-slate-200 bg-gradient-to-br from-brand-light/70 via-card to-card shadow-sm">
          <CardContent className="flex flex-col gap-5 p-5 sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand text-xl font-bold tracking-wide text-brand-foreground shadow-sm ring-4 ring-card sm:h-20 sm:w-20 sm:text-2xl">
                {initial}
              </div>
              <div className="min-w-0">
                <h1 className="break-words text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
                  {user.fullName}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground">
                    <GraduationCap size={14} aria-hidden="true" />
                    {ROLE_LABEL_TH[primaryRole]}
                  </span>
                  {isStudent && profileQuery.data && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-background/90 px-3 py-1 text-xs font-medium text-slate-600">
                      <Hash size={13} aria-hidden="true" />
                      {profileQuery.data.studentCode}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex min-w-0 items-start gap-3 rounded-lg bg-background/70 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-light text-brand">
                <Mail size={16} aria-hidden="true" />
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-xs font-medium text-muted-foreground">อีเมล</p>
                <p className="break-all text-sm font-medium leading-5 text-primary">{user.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </Reveal>

      {isStudent &&
        profileQuery.data &&
        facultiesQuery.data &&
        departmentsQuery.data &&
        programsQuery.data &&
        curriculaQuery.data && (
          <Reveal index={2}>
            <ProfileEducationCard
              profile={profileQuery.data}
              faculties={facultiesQuery.data}
              departments={departmentsQuery.data}
              programs={programsQuery.data}
              curricula={curriculaQuery.data}
            />
          </Reveal>
        )}

      <Reveal index={3}>
        <AccountSecurityCard />
      </Reveal>
    </DashboardShell>
  );
}
