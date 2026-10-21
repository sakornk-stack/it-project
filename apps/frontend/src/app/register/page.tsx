'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type {
  AccessTokenResponse,
  RegisterRequest,
  SignupStartedResponse,
} from '@eduanalyze-ai/shared-types';
import { isAxiosError } from 'axios';
import { apiClient } from '@/lib/api-client';
import { describeApiError } from '@/lib/describe-api-error';
import { OWN_SENTENCE_ONLY, RATE_LIMITED_ERROR } from '@/lib/api-error-presets';
import { fetchInvitationPreview } from '@/lib/api/auth';
import { useAuth } from '@/lib/auth-context';
import { PRIVACY_POLICY_VERSION, STALE_PRIVACY_POLICY_MESSAGE } from '@/lib/privacy-policy';
import { isStalePrivacyPolicyError } from '@/lib/privacy-policy-error';
import { cn } from '@/lib/utils';
import { HOVER_LIFT } from '@/lib/motion';
import { registerSchema, type RegisterFormValues } from '@/lib/validation/register.schema';
import {
  invitedRegisterSchema,
  type InvitedRegisterFormValues,
} from '@/lib/validation/invited-register.schema';
import { DependentOrgSelect } from '@/components/auth/dependent-org-select';
import { PrivacyConsentField } from '@/components/auth/privacy-consent-field';
import { SignupCheckEmail } from '@/components/auth/signup-check-email';
import { signupDomainsText } from '@/lib/signup-domain';
import { AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { AuthHeading } from '@/components/auth/auth-heading';
import { AuthModeTabs } from '@/components/auth/auth-mode-tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GOOGLE_LOGIN_ENABLED } from '@/lib/feature-flags';
import { Skeleton } from '@/components/ui/skeleton';
import { Reveal } from '@/components/layout/reveal';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const BRAND_COPY = {
  title: 'สมัครสมาชิกนิสิต',
  description: 'สร้างบัญชีเพื่อติดตามผลการเรียน และวิเคราะห์ผลลัพธ์การเรียนรู้และความถนัดของตนเอง',
};

export default function RegisterPage() {
  return (
    // useSearchParams requires a Suspense boundary in the App Router —
    // same pattern as the instructor course page.
    <Suspense fallback={<RegisterFallback />}>
      <RegisterPageContent />
    </Suspense>
  );
}

function RegisterFallback() {
  return (
    <AuthSplitLayout {...BRAND_COPY}>
      <div className="space-y-3">
        <Skeleton className="mx-auto h-6 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </AuthSplitLayout>
  );
}

function RegisterPageContent() {
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get('invitationToken');

  // Only meaningful when an invitationToken is present — enabled:false
  // means uninvited visitors never fire this request at all.
  const invitationQuery = useQuery({
    queryKey: ['invitation-preview', invitationToken],
    queryFn: () => fetchInvitationPreview(invitationToken!),
    enabled: !!invitationToken,
    retry: false,
  });

  if (invitationToken && invitationQuery.isLoading) {
    return (
      <AuthSplitLayout {...BRAND_COPY}>
        <div className="space-y-3">
          <Skeleton className="mx-auto h-6 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </AuthSplitLayout>
    );
  }

  // Valid invitation: show the short pre-filled form. Missing, expired, or
  // no token at all: fall back to today's fully-manual form — behavior
  // for uninvited self-registration never changes.
  if (invitationToken && invitationQuery.data) {
    return <InvitedRegisterForm token={invitationToken} preview={invitationQuery.data} />;
  }

  return <ManualRegisterForm invitationProblem={!!invitationToken && invitationQuery.isError} />;
}

function InvitedRegisterForm({
  token,
  preview,
}: Readonly<{
  token: string;
  preview: {
    email: string;
    fullName: string;
    studentCode: string;
    programCode: string;
    curriculumVersion: string;
    admissionYear: number;
  };
}>) {
  const router = useRouter();
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<InvitedRegisterFormValues>({
    resolver: zodResolver(invitedRegisterSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
      fullName: preview.fullName,
      acceptPrivacyPolicy: false,
    },
  });

  async function onSubmit(values: InvitedRegisterFormValues) {
    setServerError(null);
    // studentCode/programId/curriculumId/admissionYear are intentionally
    // omitted — the server always resolves them from invitationToken
    // itself (AuthService.register), never from what this form would send.
    const payload: RegisterRequest = {
      email: preview.email,
      password: values.password,
      fullName: values.fullName,
      invitationToken: token,
      acceptPrivacyPolicy: true,
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
    };
    try {
      const { data } = await apiClient.post<AccessTokenResponse>('/auth/register', payload);
      await login(data.accessToken);
      router.push('/dashboard');
    } catch (error) {
      if (isStalePrivacyPolicyError(error)) {
        setServerError(STALE_PRIVACY_POLICY_MESSAGE);
        return;
      }
      setServerError(
        describeApiError(
          error,
          {
            ...RATE_LIMITED_ERROR,
            409: 'อีเมลนี้ถูกใช้งานแล้ว',
            401: 'คำเชิญนี้หมดอายุหรือถูกใช้ไปแล้ว ติดต่อเจ้าหน้าที่เพื่อขอคำเชิญใหม่',
          },
          undefined,
          OWN_SENTENCE_ONLY,
        ),
      );
    }
  }

  return (
    <AuthSplitLayout {...BRAND_COPY}>
      <AuthHeading
        title="สมัครสมาชิกด้วยคำเชิญ"
        description="ตั้งรหัสผ่านเพื่อเริ่มใช้งาน ข้อมูลหลักสูตรถูกกรอกไว้ล่วงหน้าโดยเจ้าหน้าที่"
      />

      <dl className="mb-5 space-y-1 rounded-md border bg-muted p-3 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">อีเมล</dt>
          <dd className="text-primary">{preview.email}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">รหัสนิสิต</dt>
          <dd className="text-primary">{preview.studentCode}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">สาขา / ฉบับหลักสูตร</dt>
          <dd className="text-primary">
            {preview.programCode} / {preview.curriculumVersion}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">ปีเข้าศึกษา</dt>
          <dd className="text-primary">{preview.admissionYear}</dd>
        </div>
      </dl>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <Alert variant="destructive" className="animate-shake">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ชื่อ-นามสกุล</FormLabel>
                <FormControl>
                  <Input autoComplete="name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>รหัสผ่าน</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" showStrength {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ยืนยันรหัสผ่านอีกครั้ง</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <PrivacyConsentField />

          <Button
            type="submit"
            className={cn('w-full', HOVER_LIFT)}
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? 'กำลังสมัครสมาชิก...' : 'สมัครสมาชิก'}
          </Button>
        </form>
      </Form>
    </AuthSplitLayout>
  );
}

// The server's own Thai sentence for a refused domain (400), which the form's
// generic 400 text ("bad curriculum") would otherwise hide.
function domainRefusal(error: unknown): string | null {
  if (!isAxiosError(error) || error.response?.status !== 400) return null;
  const message = (error.response.data as { message?: unknown } | undefined)?.message;
  return typeof message === 'string' && message.startsWith('สมัครด้วยตนเองได้เฉพาะอีเมล')
    ? message
    : null;
}

function ManualRegisterForm({ invitationProblem }: Readonly<{ invitationProblem: boolean }>) {
  const [serverError, setServerError] = useState<string | null>(null);
  // Set once the server has accepted the sign-up: the form gives way to the
  // "check your email" panel. No account exists until the mailed link is used.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      fullName: '',
      studentCode: '',
      facultyId: '',
      departmentId: '',
      programId: '',
      curriculumId: '',
      admissionYear: undefined,
      acceptPrivacyPolicy: false,
    },
  });

  async function onSubmit(values: RegisterFormValues) {
    setServerError(null);
    // facultyId/departmentId only drive the dependent select — the
    // backend's RegisterDto doesn't take them (a curriculum's program is
    // already unambiguous once curriculumId is chosen).
    const payload: RegisterRequest = {
      email: values.email,
      password: values.password,
      fullName: values.fullName,
      studentCode: values.studentCode,
      programId: values.programId,
      curriculumId: values.curriculumId,
      admissionYear: values.admissionYear,
      acceptPrivacyPolicy: true,
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
    };
    try {
      await apiClient.post<SignupStartedResponse>('/auth/register', payload);
      setSentTo(values.email.trim().toLowerCase());
    } catch (error) {
      if (isStalePrivacyPolicyError(error)) {
        setServerError(STALE_PRIVACY_POLICY_MESSAGE);
        return;
      }
      const refusal = domainRefusal(error);
      if (refusal) {
        setServerError(refusal);
        return;
      }
      setServerError(
        describeApiError(
          error,
          {
            ...RATE_LIMITED_ERROR,
            400: 'ข้อมูลหลักสูตรไม่ถูกต้อง กรุณาเลือกใหม่',
          },
          undefined,
          OWN_SENTENCE_ONLY,
        ),
      );
    }
  }

  return (
    <AuthSplitLayout {...BRAND_COPY}>
      <Reveal index={0}>
        <AuthHeading
          title="สมัครสมาชิก"
          description={
            <>
              <span className="block">สำหรับนิสิตเท่านั้น</span>
              <span className="block">
                บุคลากรและอาจารย์ให้ติดต่อผู้ดูแลระบบของ<span className="whitespace-nowrap">หน่วยงาน</span>
              </span>
            </>
          }
        />
        {invitationProblem && (
          <Alert role="alert" className="mb-4">
            <AlertDescription>
              <span className="block font-semibold">ลิงก์คำเชิญไม่ถูกต้องหรือหมดอายุ</span>
              <span className="block">
                ติดต่อเจ้าหน้าที่เพื่อขอคำเชิญใหม่ หรือสมัครด้วยตนเองตามแบบฟอร์มด้านล่าง
              </span>
            </AlertDescription>
          </Alert>
        )}

        <AuthModeTabs active="register" />
      </Reveal>

      {sentTo ? (
        <SignupCheckEmail email={sentTo} onStartOver={() => setSentTo(null)} />
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {serverError && (
              <Alert variant="destructive" className="animate-shake">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <Reveal index={2} className="space-y-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground">ข้อมูลบัญชี</p>
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ชื่อ-นามสกุล</FormLabel>
                    <FormControl>
                      <Input autoComplete="name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>อีเมล</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      ใช้อีเมล {signupDomainsText()} ของมหาวิทยาลัย
                      ระบบจะส่งลิงก์ยืนยันไปที่อีเมลนี้
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>รหัสผ่าน</FormLabel>
                    <FormControl>
                      <PasswordInput autoComplete="new-password" showStrength {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ยืนยันรหัสผ่านอีกครั้ง</FormLabel>
                    <FormControl>
                      <PasswordInput autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Reveal>

            <Reveal index={4} className="space-y-4">
              <p className="pt-2 text-xs font-medium tracking-wide text-muted-foreground">
                ข้อมูลการศึกษา
              </p>
              <FormField
                control={form.control}
                name="studentCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>รหัสนิสิต</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="admissionYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ปีที่เข้าศึกษา (พ.ศ.)</FormLabel>
                    <FormControl>
                      {/* Value starts undefined (empty keeps the schema's own message); ''
                          keeps the <input> controlled from the first render. */}
                      <Input type="number" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DependentOrgSelect />
              <PrivacyConsentField />
            </Reveal>

            <Reveal index={6}>
              <Button
                type="submit"
                className={cn('w-full', HOVER_LIFT)}
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? 'กำลังสมัครสมาชิก...' : 'สมัครสมาชิก'}
              </Button>
            </Reveal>
          </form>
        </Form>
      )}

      {GOOGLE_LOGIN_ENABLED && (
        <Reveal index={6}>
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">หรือสมัครด้วย</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <a href={`${process.env.NEXT_PUBLIC_API_URL}/auth/google`}>
            <Button type="button" variant="outline" className={cn('w-full', HOVER_LIFT)}>
              Google
            </Button>
          </a>
        </Reveal>
      )}
    </AuthSplitLayout>
  );
}
