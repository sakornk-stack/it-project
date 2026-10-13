'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Check, Copy, ShieldAlert, ShieldCheck } from 'lucide-react';
import { disableTwoFactor, enableTwoFactor, setupTwoFactor } from '@/lib/api/two-factor';
import {
  twoFactorDisableSchema,
  twoFactorEnableSchema,
  type TwoFactorDisableFormValues,
  type TwoFactorEnableFormValues,
} from '@/lib/validation/two-factor.schema';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { OtpInput } from '@/components/ui/otp-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';

// Same Card + react-hook-form + zod + apiClient pattern as
// ChangePasswordForm — the closest existing analog. No Dialog primitive
// exists anywhere in this project, so every step here is an inline
// section swap within one Card rather than a modal.
type Mode = 'view' | 'setup' | 'recoveryCodes' | 'disable';

export function TwoFactorSection({ embedded = false }: Readonly<{ embedded?: boolean }>) {
  const { user, refreshUser } = useAuth();
  const [mode, setMode] = useState<Mode>('view');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const enabled = !!user?.twoFactorEnabled;

  async function handleDone() {
    setMode('view');
    setRecoveryCodes([]);
    await refreshUser();
  }

  const content = (
    <>
      <CardHeader className={embedded ? 'p-0' : undefined}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className={embedded ? 'text-base' : undefined}>
              ยืนยันตัวตนสองขั้นตอน (2FA)
            </CardTitle>
            <CardDescription>ใช้แอปยืนยันตัวตน (เช่น Google Authenticator, Authy) เพิ่มความปลอดภัยตอนเข้าสู่ระบบ</CardDescription>
          </div>
          {mode === 'view' && (
            <Badge tone={enabled ? 'success' : 'neutral'}>{enabled ? 'เปิดอยู่' : 'ปิดอยู่'}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className={cn('space-y-4', embedded && 'p-0 pt-4')}>
        {mode === 'view' && (
          <div>
            {enabled ? (
              <Button type="button" variant="outline" onClick={() => setMode('disable')}>
                ปิดใช้งาน 2FA
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => setMode('setup')}>
                เปิดใช้งาน 2FA
              </Button>
            )}
          </div>
        )}

        {(mode === 'setup' || mode === 'recoveryCodes') && <TwoFactorStepper mode={mode} />}

        {mode === 'setup' && (
          <TwoFactorSetupFlow
            onCancel={() => setMode('view')}
            onEnabled={(codes) => {
              setRecoveryCodes(codes);
              setMode('recoveryCodes');
            }}
          />
        )}

        {mode === 'recoveryCodes' && (
          <TwoFactorRecoveryCodesReveal recoveryCodes={recoveryCodes} onDone={handleDone} />
        )}

        {mode === 'disable' && (
          <TwoFactorDisableFlow onCancel={() => setMode('view')} onDisabled={handleDone} />
        )}
      </CardContent>
    </>
  );

  return embedded ? <div>{content}</div> : <Card>{content}</Card>;
}

// Purely derived from the existing `mode` state — no new state, no prop
// drilling into the flow components below. Kept private/local since this
// is the only multi-step flow in the app right now; a shared component
// would be premature abstraction.
function TwoFactorStepper({ mode }: Readonly<{ mode: Mode }>) {
  const steps = [
    { n: 1, label: 'สแกน QR' },
    { n: 2, label: 'ยืนยันรหัส' },
    { n: 3, label: 'บันทึกรหัสสำรอง' },
  ];

  return (
    <ol className="flex items-center">
      {steps.map((s, i) => {
        const done = mode === 'recoveryCodes' ? s.n < 3 : s.n < 2;
        const current = mode === 'recoveryCodes' ? s.n === 3 : s.n === 2;
        let circleTone = 'border-slate-300 text-slate-400';
        if (done) circleTone = 'border-emerald-500 bg-emerald-500 text-white';
        else if (current) circleTone = 'border-brand bg-brand text-white dark:text-brand-foreground';
        return (
          <li key={s.n} className="flex flex-1 items-center gap-2 last:flex-none">
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors duration-200',
                circleTone,
              )}
            >
              {done ? <Check size={12} strokeWidth={3} /> : s.n}
            </span>
            <span
              className={cn(
                'text-xs',
                done || current ? 'font-medium text-primary' : 'text-muted-foreground',
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && <span className="mx-1 h-px flex-1 bg-slate-200" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

function TwoFactorSetupFlow({
  onCancel,
  onEnabled,
}: {
  onCancel: () => void;
  onEnabled: (recoveryCodes: string[]) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const setupQuery = useQuery({ queryKey: ['two-factor-setup'], queryFn: setupTwoFactor });
  const form = useForm<TwoFactorEnableFormValues>({
    resolver: zodResolver(twoFactorEnableSchema),
    defaultValues: { code: '' },
  });

  async function onSubmit(values: TwoFactorEnableFormValues) {
    setServerError(null);
    try {
      const { recoveryCodes } = await enableTwoFactor(values);
      // Brief success beat before handing off to the recovery-codes step —
      // an instant jump reads as "did anything happen?" on a 2-field form.
      setVerified(true);
      setTimeout(() => onEnabled(recoveryCodes), 500);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        setServerError('รหัสไม่ถูกต้อง ลองสแกน QR ใหม่หรือกรอกรหัสอีกครั้ง');
      } else {
        setServerError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      }
    }
  }

  async function handleCopySecret(secret: string) {
    await navigator.clipboard.writeText(secret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  }

  if (setupQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mx-auto h-40 w-40" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }
  if (setupQuery.isError || !setupQuery.data) {
    return <p className="text-sm text-destructive">ไม่สามารถสร้างรหัสลับได้ กรุณาลองใหม่อีกครั้ง</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          เปิดแอปยืนยันตัวตน แล้วสแกน QR ด้านล่าง (หรือกรอกรหัสด้วยตัวเองถ้าสแกนไม่ได้)
        </p>
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-2xl border border-slate-200 bg-card p-4 shadow-sm">
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL, not a static asset */}
              <img
                src={setupQuery.data.qrCodeDataUrl}
                alt="QR code สำหรับตั้งค่า 2FA"
                className={`h-40 w-40 rounded-lg border transition-colors duration-300 ${
                  verified ? 'border-emerald-400' : 'border-slate-200'
                }`}
              />
              {verified && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-card/80 animate-in fade-in zoom-in duration-300">
                  <ShieldCheck className="h-12 w-12 text-emerald-600" />
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">สแกนด้วยแอปยืนยันตัวตน</p>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2">
          <p className="min-w-0 flex-1 break-all font-mono text-xs text-muted-foreground">
            {setupQuery.data.secret}
          </p>
          <button
            type="button"
            onClick={() => handleCopySecret(setupQuery.data.secret)}
            className="shrink-0 text-slate-400 transition-colors duration-150 hover:text-brand motion-safe:active:scale-90"
            aria-label={secretCopied ? 'คัดลอกรหัสลับแล้ว' : 'คัดลอกรหัสลับ'}
          >
            {secretCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>กรอกรหัส 6 หลักจากแอป</FormLabel>
                <FormControl>
                  <OtpInput
                    value={field.value}
                    onChange={field.onChange}
                    hasError={!!serverError}
                    disabled={verified}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={form.formState.isSubmitting || verified}>
              {form.formState.isSubmitting ? 'กำลังยืนยัน...' : 'ยืนยันและเปิดใช้งาน'}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={verified}>
              ยกเลิก
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

function TwoFactorRecoveryCodesReveal({
  recoveryCodes,
  onDone,
}: {
  recoveryCodes: string[];
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopyAll() {
    await navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription>เปิดใช้งาน 2FA สำเร็จ</AlertDescription>
      </Alert>
      <div>
        <div className="mb-2 flex items-center justify-end">
          <Button type="button" variant="outline" size="sm" onClick={handleCopyAll}>
            {copied ? (
              <>
                <Check className="mr-1.5 h-3.5 w-3.5" /> คัดลอกแล้ว
              </>
            ) : (
              <>
                <Copy className="mr-1.5 h-3.5 w-3.5" /> คัดลอกทั้งหมด
              </>
            )}
          </Button>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="mb-3 flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <p className="text-sm font-semibold text-amber-900">
              เก็บรหัสสำรองเหล่านี้ไว้ในที่ปลอดภัย — ระบบจะแสดงเพียงครั้งเดียว
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {recoveryCodes.map((code) => (
              <span
                key={code}
                className="rounded-md border border-amber-200 bg-card px-3 py-2 text-center font-mono text-sm text-slate-700 shadow-sm"
              >
                {code}
              </span>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          ใช้รหัสเหล่านี้แทนแอปยืนยันตัวตน ได้ครั้งละ 1 รหัส ถ้าทำมือถือหายหรือเข้าแอปไม่ได้
        </p>
      </div>
      <Button type="button" onClick={onDone}>
        รับทราบ เสร็จสิ้น
      </Button>
    </div>
  );
}

function TwoFactorDisableFlow({
  onCancel,
  onDisabled,
}: {
  onCancel: () => void;
  onDisabled: () => void;
}) {
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<TwoFactorDisableFormValues>({
    resolver: zodResolver(twoFactorDisableSchema),
    defaultValues: { password: '' },
  });

  async function onSubmit(values: TwoFactorDisableFormValues) {
    setServerError(null);
    try {
      await disableTwoFactor(values);
      toast.success('ปิดใช้งาน 2FA สำเร็จ');
      onDisabled();
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        setServerError('รหัสผ่านไม่ถูกต้อง');
      } else {
        setServerError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      }
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem className="max-w-sm">
              <FormLabel>กรอกรหัสผ่านปัจจุบันเพื่อยืนยัน</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2">
          <Button type="submit" variant="destructive" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'กำลังปิดใช้งาน...' : 'ยืนยันปิดใช้งาน 2FA'}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            ยกเลิก
          </Button>
        </div>
      </form>
    </Form>
  );
}
