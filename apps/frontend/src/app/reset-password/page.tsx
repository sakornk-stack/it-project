'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import { apiClient } from '@/lib/api-client';
import { describeApiError } from '@/lib/describe-api-error';
import { OWN_SENTENCE_ONLY, RATE_LIMITED_ERROR } from '@/lib/api-error-presets';
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from '@/lib/validation/reset-password.schema';
import { useToast } from '@/lib/toast-context';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AuthHeading } from '@/components/auth/auth-heading';
import { AuthLoadingScreen } from '@/components/auth/auth-loading-screen';
import { AuthSplitLayout } from '@/components/auth/auth-split-layout';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const BRAND_COPY = {
  title: 'ตั้งรหัสผ่านใหม่',
  description: 'ตั้งรหัสผ่านใหม่ที่ปลอดภัย เพื่อกลับเข้าสู่ระบบด้วยบัญชีเดิมของคุณ',
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthLoadingScreen />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [serverError, setServerError] = useState<string | null>(null);
  const [linkExpired, setLinkExpired] = useState(false);
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmNewPassword: '' },
  });

  async function onSubmit(values: ResetPasswordFormValues) {
    setServerError(null);
    try {
      await apiClient.post('/auth/reset-password', { token, newPassword: values.newPassword });
      toast.success('ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่');
      router.push('/login');
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        setServerError('ลิงก์นี้หมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่');
        setLinkExpired(true);
      } else {
        setServerError(describeApiError(error, RATE_LIMITED_ERROR, undefined, OWN_SENTENCE_ONLY));
      }
    }
  }

  if (!token) {
    return (
      <AuthSplitLayout {...BRAND_COPY}>
        <AuthHeading title="ตั้งรหัสผ่านใหม่" />
        <div className="space-y-3">
          <Alert variant="destructive">
            <AlertDescription>ลิงก์ไม่ถูกต้อง กรุณาขอลิงก์รีเซ็ตรหัสผ่านใหม่</AlertDescription>
          </Alert>
          <Button asChild className="w-full">
            <Link href="/forgot-password">ขอลิงก์ใหม่</Link>
          </Button>
        </div>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout {...BRAND_COPY}>
      <AuthHeading title="ตั้งรหัสผ่านใหม่" description="กรอกรหัสผ่านใหม่ของคุณ" />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
          {linkExpired && (
            <Button asChild variant="outline" className="w-full">
              <Link href="/forgot-password">ขอลิงก์ใหม่</Link>
            </Button>
          )}
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>รหัสผ่านใหม่</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" showStrength {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmNewPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ยืนยันรหัสผ่านใหม่อีกครั้ง</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านใหม่'}
          </Button>
        </form>
      </Form>
    </AuthSplitLayout>
  );
}
