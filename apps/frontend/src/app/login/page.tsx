'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, ShieldCheck } from 'lucide-react';
import type { LoginResponse } from '@eduanalyze-ai/shared-types';
import { googleLoginErrorMessage } from '@/lib/google-login-error';
import { takeTokenFromUrl } from '@/lib/signup-domain';
import { apiClient } from '@/lib/api-client';
import { describeApiError } from '@/lib/describe-api-error';
import { OWN_SENTENCE_ONLY, RATE_LIMITED_ERROR } from '@/lib/api-error-presets';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { resolvePostLoginRoute } from '@/lib/dashboard-routes';
import { GOOGLE_NEXT_STORAGE_KEY, NEXT_PARAM, sanitizeNextPath } from '@/lib/safe-next-path';
import { HOVER_LIFT } from '@/lib/motion';
import {
  parseSessionEndReason,
  REASON_PARAM,
  SESSION_END_MESSAGE_TH,
} from '@/lib/session-end-reason';
import { verifyTwoFactor } from '@/lib/api/two-factor';
import { loginSchema, type LoginFormValues } from '@/lib/validation/login.schema';
import {
  twoFactorVerifyRecoverySchema,
  twoFactorVerifyTotpSchema,
  type TwoFactorVerifyRecoveryFormValues,
  type TwoFactorVerifyTotpFormValues,
} from '@/lib/validation/two-factor.schema';
import { AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { AuthHeading } from '@/components/auth/auth-heading';
import { AuthModeTabs } from '@/components/auth/auth-mode-tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { GOOGLE_LOGIN_ENABLED } from '@/lib/feature-flags';
import { OtpInput } from '@/components/ui/otp-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const BRAND_COPY = {
  title: 'ยินดีต้อนรับกลับมา',
  description:
    'เข้าสู่ระบบเพื่อติดตามความก้าวหน้าทางการเรียน วิเคราะห์ผลลัพธ์การเรียนรู้ CLO/PLO และวางแผนเส้นทางสู่ความสำเร็จของนิสิต',
};

export default function LoginPage() {
  return (
    // useSearchParams (for the Google-callback ?pendingToken=&requires2fa=1
    // case below) requires a Suspense boundary in the App Router.
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, status, user } = useAuth();
  const nextParam = searchParams.get(NEXT_PARAM);
  const [serverError, setServerError] = useState<string | null>(() =>
    googleLoginErrorMessage(searchParams.get('googleError')),
  );
  // Why the last session ended (?reason=idle|absolute|refresh-failed). A
  // neutral notice rather than a destructive error: nothing the user did wrong.
  // Whitelisted, so a crafted URL cannot put arbitrary text on the page.
  const endReason = parseSessionEndReason(searchParams.get(REASON_PARAM));
  const sessionEndNotice = endReason ? SESSION_END_MESSAGE_TH[endReason] : null;
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const totpForm = useForm<TwoFactorVerifyTotpFormValues>({
    resolver: zodResolver(twoFactorVerifyTotpSchema),
    defaultValues: { code: '' },
  });
  const recoveryForm = useForm<TwoFactorVerifyRecoveryFormValues>({
    resolver: zodResolver(twoFactorVerifyRecoverySchema),
    defaultValues: { code: '' },
  });

  function toggleRecoveryMode() {
    setIsRecoveryMode((v) => !v);
    totpForm.reset({ code: '' });
    recoveryForm.reset({ code: '' });
    setServerError(null);
  }

  // Google OAuth's callback is a top-level redirect (can't return JSON),
  // so when that account has 2FA enabled it lands back here with the
  // pending token in the URL instead of a normal API response — jump
  // straight to the code-entry step.
  useEffect(() => {
    const tokenFromGoogle = searchParams.get('pendingToken');
    if (tokenFromGoogle && searchParams.get('requires2fa') === '1') {
      setPendingToken(tokenFromGoogle);
      // Held in state now; don't leave the 2FA token in the address bar.
      takeTokenFromUrl(window, 'pendingToken');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Single exit point for every way of signing in (password, 2FA, and a
  // Google return, which lands here already authenticated via the refresh
  // cookie) — and it also moves an already-signed-in visitor off /login.
  // Google can't carry ?next= through its round-trip, so that one is parked
  // in sessionStorage by the Google button below and read back here once.
  useEffect(() => {
    if (status !== 'authenticated' || !user) return;
    let storedNext: string | null = null;
    try {
      storedNext = sessionStorage.getItem(GOOGLE_NEXT_STORAGE_KEY);
      sessionStorage.removeItem(GOOGLE_NEXT_STORAGE_KEY);
    } catch {
      // Storage blocked — fall back to ?next= / home.
    }
    router.replace(resolvePostLoginRoute(nextParam ?? storedNext, user.roles));
  }, [status, user, nextParam, router]);

  function rememberNextForGoogle() {
    try {
      const safeNext = sanitizeNextPath(nextParam);
      if (safeNext) sessionStorage.setItem(GOOGLE_NEXT_STORAGE_KEY, safeNext);
      else sessionStorage.removeItem(GOOGLE_NEXT_STORAGE_KEY);
    } catch {
      // Storage blocked — Google sign-in still works, it just lands on home.
    }
  }

  async function onSubmitCredentials(values: LoginFormValues) {
    setServerError(null);
    try {
      const { data } = await apiClient.post<LoginResponse>('/auth/login', values);
      if ('requiresTwoFactor' in data) {
        setPendingToken(data.pendingToken);
        return;
      }
      await login(data.accessToken);
    } catch (error) {
      setServerError(
        describeApiError(
          error,
          { ...RATE_LIMITED_ERROR, 401: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' },
          undefined,
          OWN_SENTENCE_ONLY,
        ),
      );
    }
  }

  async function onSubmitTwoFactor(
    values: TwoFactorVerifyTotpFormValues | TwoFactorVerifyRecoveryFormValues,
  ) {
    setServerError(null);
    if (!pendingToken) return;
    try {
      const data = await verifyTwoFactor(pendingToken, values);
      if ('requiresTwoFactor' in data) {
        // Unreachable in practice (verify() always issues real tokens on
        // success) — kept only so the discriminated union is exhaustive.
        return;
      }
      await login(data.accessToken);
    } catch (error) {
      setServerError(
        describeApiError(
          error,
          { ...RATE_LIMITED_ERROR, 401: 'รหัสยืนยันไม่ถูกต้องหรือหมดอายุ — ลองเข้าสู่ระบบใหม่อีกครั้ง' },
          undefined,
          OWN_SENTENCE_ONLY,
        ),
      );
    }
  }

  // Session check still running, or signed in and about to be redirected —
  // don't flash a login form at someone who is already in.
  if (status === 'loading' || status === 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-3">
          <Skeleton className="mx-auto h-10 w-10 rounded-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    );
  }

  if (pendingToken) {
    return (
      <AuthSplitLayout {...BRAND_COPY}>
        <div className="mb-4 flex">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light">
            <ShieldCheck size={24} className="text-brand" aria-hidden="true" />
          </div>
        </div>
        <AuthHeading
          title="ยืนยันตัวตนสองขั้นตอน"
          description="กรอกรหัส 6 หลักจากแอปยืนยันตัวตน หรือรหัสสำรอง"
        />

        {isRecoveryMode ? (
          <Form {...recoveryForm}>
            <form onSubmit={recoveryForm.handleSubmit(onSubmitTwoFactor)} className="space-y-4">
              {serverError && (
                <Alert variant="destructive">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}
              <FormField
                control={recoveryForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>กรอกรหัสสำรอง</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="XXXX-XXXX"
                        autoComplete="one-time-code"
                        className={serverError ? 'animate-shake border-destructive' : ''}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="text-right text-sm">
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center font-medium text-brand hover:underline"
                  onClick={toggleRecoveryMode}
                >
                  กลับไปใช้รหัสจากแอปยืนยันตัวตน
                </button>
              </div>
              <Button type="submit" className="w-full" disabled={recoveryForm.formState.isSubmitting}>
                {recoveryForm.formState.isSubmitting ? 'กำลังยืนยัน...' : 'ยืนยัน'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setPendingToken(null);
                  setServerError(null);
                  setIsRecoveryMode(false);
                }}
              >
                กลับไปเข้าสู่ระบบใหม่
              </Button>
            </form>
          </Form>
        ) : (
          <Form {...totpForm}>
            <form onSubmit={totpForm.handleSubmit(onSubmitTwoFactor)} className="space-y-4">
              {serverError && (
                <Alert variant="destructive">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}
              <FormField
                control={totpForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>กรอกรหัส 6 หลักจากแอปยืนยันตัวตน</FormLabel>
                    <FormControl>
                      <OtpInput
                        value={field.value}
                        onChange={field.onChange}
                        hasError={!!serverError}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="text-right text-sm">
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center font-medium text-brand hover:underline"
                  onClick={toggleRecoveryMode}
                >
                  ใช้รหัสสำรองแทน
                </button>
              </div>
              <Button type="submit" className="w-full" disabled={totpForm.formState.isSubmitting}>
                {totpForm.formState.isSubmitting ? 'กำลังยืนยัน...' : 'ยืนยัน'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setPendingToken(null);
                  setServerError(null);
                  setIsRecoveryMode(false);
                }}
              >
                กลับไปเข้าสู่ระบบใหม่
              </Button>
            </form>
          </Form>
        )}
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout {...BRAND_COPY}>
      <AuthHeading title="เข้าสู่ระบบ" />

      <AuthModeTabs active="login" />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmitCredentials)} className="space-y-4">
          {sessionEndNotice && (
            <Alert role="status">
              <AlertDescription>{sessionEndNotice}</AlertDescription>
            </Alert>
          )}
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>อีเมล</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail
                      size={16}
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.ac.th"
                      className={cn('pl-9', serverError && 'animate-shake border-destructive')}
                      {...field}
                    />
                  </div>
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
                  <PasswordInput
                    autoComplete="current-password"
                    className={cn(serverError && 'animate-shake border-destructive')}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="text-right text-sm">
            <Link
              href="/forgot-password"
              className="inline-flex min-h-11 items-center font-medium text-brand hover:underline"
            >
              ลืมรหัสผ่าน?
            </Link>
          </div>

          <Button
            type="submit"
            className={cn('w-full', HOVER_LIFT)}
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </Button>
        </form>
      </Form>

      {GOOGLE_LOGIN_ENABLED && (
        <>
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">หรือเข้าสู่ระบบด้วย</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button asChild variant="outline" className="w-full gap-2">
            <a href={`${process.env.NEXT_PUBLIC_API_URL}/auth/google`} onClick={rememberNextForGoogle}>
              <GoogleIcon />
              Google
            </a>
          </Button>
        </>
      )}
    </AuthSplitLayout>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3.02h3.88c2.27-2.09 3.57-5.17 3.57-8.84z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3.02c-1.08.73-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24z"
      />
      <path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.62H1.27a12 12 0 0 0 0 10.76z" />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.62l4 3.11C6.22 6.88 8.87 4.77 12 4.77z"
      />
    </svg>
  );
}
