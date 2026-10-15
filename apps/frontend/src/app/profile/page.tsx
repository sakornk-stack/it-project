'use client';

import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  BookOpen,
  Building2,
  CalendarDays,
  GraduationCap,
  Hash,
  Landmark,
  Mail,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type {
  CurriculumListItem,
  DepartmentListItem,
  FacultyListItem,
  ProgramListItem,
  Role,
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
import { accountStatus, type AccountStatus } from '@/lib/account-status';
import { useAuth } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { AccountSecurityCard } from '@/components/profile/account-security-card';
import { primaryRoleFor, ROLE_BADGE_TONE, ROLE_LABEL_TH } from '@/components/auth/require-role';
import { CopyEmailButton } from '@/components/admin/user-profile-card';
import { DetailSectionHeader } from '@/components/ui/detail-section-header';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoadError } from '@/components/layout/page-states';
import { Reveal } from '@/components/layout/reveal';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { ICON_TILE_CLASS, PROFILE_CARD_CLASS } from '@/components/profile/profile-card-class';
import { SecurityStatus } from '@/components/profile/security-row';
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
    <div className={cn('flex min-w-0 items-start gap-3', className)}>
      <div className={cn(ICON_TILE_CLASS, 'h-10 w-10')}>
        <Icon size={18} aria-hidden="true" />
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="course-name-break text-sm font-semibold leading-relaxed tabular-nums text-primary">
          {value}
        </p>
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
    <Card className={PROFILE_CARD_CLASS}>
      <DetailSectionHeader
        icon={GraduationCap}
        title="ข้อมูลการศึกษา"
        description="หลักสูตรและหน่วยงานการศึกษาปัจจุบัน"
      />
      <CardContent className="grid gap-x-8 gap-y-4 px-4 pb-4 pt-0 sm:grid-cols-2 sm:px-6 sm:pb-6 xl:grid-cols-3">
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

function InfoCell({
  icon: Icon,
  label,
  children,
}: Readonly<{ icon: LucideIcon; label: string; children: ReactNode }>) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border bg-muted/40 p-3">
      <span aria-hidden="true" className={cn(ICON_TILE_CLASS, 'hidden h-10 w-10 min-[400px]:flex')}>
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium leading-relaxed text-primary">{children}</dd>
      </div>
    </div>
  );
}

function ProfileSummaryCard({
  fullName,
  email,
  roles,
  studentCode,
  status,
}: Readonly<{
  fullName: string;
  email: string;
  roles: Role[];
  studentCode?: string;
  status: AccountStatus;
}>) {
  // The avatar is always brand-coloured; the role colour lives only on the role chips.
  return (
    <Card className={PROFILE_CARD_CLASS}>
      {/* Thin banner: brand tint fading into the card, no image. */}
      <div
        aria-hidden="true"
        className="h-[4.5rem] bg-gradient-to-b from-brand-light via-brand-light/60 to-card sm:h-20"
      />
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        <div className="-mt-10 flex flex-col gap-5 sm:-mt-12 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
          <div className="min-w-0 space-y-3">
            <InitialsAvatar
              name={fullName}
              className="h-20 w-20 border-0 bg-gradient-to-br from-brand to-brand/70 text-3xl text-brand-foreground shadow-md ring-2 ring-card dark:shadow-[0_0_22px_hsl(var(--brand)/0.25)] sm:h-24 sm:w-24 sm:text-4xl"
            />
            <h2
              title={fullName}
              className="course-name-break text-xl font-bold leading-snug text-primary sm:text-2xl"
            >
              {fullName}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {roles.map((role) => (
                <Badge key={role} tone={ROLE_BADGE_TONE[role]}>
                  {ROLE_LABEL_TH[role]}
                </Badge>
              ))}
              {studentCode && (
                <Badge tone="neutral" className="gap-1 font-mono tabular-nums">
                  <Hash size={12} aria-hidden="true" />
                  {studentCode}
                </Badge>
              )}
            </div>
          </div>
          <dl className="grid min-w-0 gap-3 lg:w-[34rem] lg:max-w-[60%] lg:grid-cols-[minmax(0,1fr)_auto]">
            <InfoCell icon={Mail} label="อีเมล">
              <div className="flex min-w-0 items-center gap-1">
                <span
                  className="min-w-0 flex-1 break-all sm:truncate sm:break-normal"
                  title={email}
                >
                  {email}
                </span>
                <CopyEmailButton email={email} tooltip={false} />
              </div>
            </InfoCell>
            <InfoCell icon={ShieldCheck} label="สถานะบัญชี">
              <SecurityStatus tone={status.tone} label={status.label} live={status.live} />
            </InfoCell>
          </dl>
        </div>
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

  const identityLabel = isStudent ? profileQuery.data?.studentCode : user.email;

  return (
    <DashboardShell
      role={primaryRole}
      identityLabel={identityLabel}
      fullName={user.fullName}
      skeleton={skeleton}
    >
      <Reveal index={0}>
        <PageHeader
          title="โปรไฟล์และความปลอดภัย"
          description="ข้อมูลบัญชีของคุณและการตั้งค่าความปลอดภัย"
        />
      </Reveal>

      <Reveal index={1}>
        <ProfileSummaryCard
          fullName={user.fullName}
          email={user.email}
          roles={user.roles}
          studentCode={isStudent ? profileQuery.data?.studentCode : undefined}
          // A signed-in account is active by definition; only the password flag is in /auth/me.
          status={accountStatus({ isActive: true, mustChangePassword: user.mustChangePassword })}
        />
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
