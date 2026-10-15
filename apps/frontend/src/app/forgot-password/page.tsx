'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiClient } from '@/lib/api-client';
import { describeApiError } from '@/lib/describe-api-error';
import { OWN_SENTENCE_ONLY, RATE_LIMITED_ERROR } from '@/lib/api-error-presets';
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from '@/lib/validation/forgot-password.schema';
import { useToast } from '@/lib/toast-context';
import { cn } from '@/lib/utils';
import { HOVER_LIFT } from '@/lib/motion';
import { AuthHeading } from '@/components/auth/auth-heading';
import { AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { Reveal } from '@/components/layout/reveal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  title: 'การตั้งรหัสผ่านใหม่',
  description:
    'ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลที่ใช้สมัครสมาชิก กรุณาทำตามขั้นตอนในอีเมล',
};

export default function ForgotPasswordPage() {
  const toast = useToast();
  const [submitted, setSubmitted] = useState(false);
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: ForgotPasswordFormValues) {
    // Backend always returns the same response whether or not the email
    // exists (prevents account enumeration) — so this UI never branches
    // on the result, only on request success vs. network failure.
    try {
      await apiClient.post('/auth/forgot-password', values);
      setSubmitted(true);
      toast.success('ส่งคำขอสำเร็จ');
    } catch (error) {
      toast.error(
        describeApiError(
          error,
          RATE_LIMITED_ERROR,
          'ส่งคำขอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
          OWN_SENTENCE_ONLY,
        ),
      );
    }
  }

  return (
    <AuthSplitLayout {...BRAND_COPY}>
      <Reveal index={0}>
        <AuthHeading
          title="ลืมรหัสผ่าน"
          description="กรอกอีเมลที่ใช้สมัครสมาชิก ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้"
        />
      </Reveal>

      {submitted ? (
        <Reveal index={1}>
          <Alert role="status">
            <AlertDescription>
              หากมีบัญชีที่ใช้อีเมลนี้อยู่ในระบบ ระบบได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้แล้ว
            </AlertDescription>
          </Alert>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center font-medium text-brand hover:underline"
            >
              กลับไปเข้าสู่ระบบ
            </Link>
          </p>
        </Reveal>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Reveal index={1}>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>อีเมล</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Reveal>

            <Reveal index={2} className="flex flex-col gap-3">
              <Button
                type="submit"
                className={cn('w-full', HOVER_LIFT)}
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? 'กำลังส่ง...' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link
                  href="/login"
                  className="inline-flex min-h-11 items-center font-medium text-brand hover:underline"
                >
                  กลับไปเข้าสู่ระบบ
                </Link>
              </p>
            </Reveal>
          </form>
        </Form>
      )}
    </AuthSplitLayout>
  );
}
