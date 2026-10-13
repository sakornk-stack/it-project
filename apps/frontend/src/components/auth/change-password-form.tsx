'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { isAxiosError } from 'axios';
import type { ChangePasswordRequest } from '@eduanalyze-ai/shared-types';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from '@/lib/validation/change-password.schema';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

// Shared by the forced first-login gate (ProtectedRoute) and the voluntary
// "เปลี่ยนรหัสผ่าน" section on /profile — same PATCH /auth/change-password
// call either way, callers differ only in copy and what happens after
// success (the gate needs nothing extra; a re-render once refreshUser()
// resolves clears it on its own).
export function ChangePasswordForm({
  title = 'เปลี่ยนรหัสผ่าน',
  description,
  onSuccess,
  variant = 'card',
}: {
  title?: string;
  description?: string;
  onSuccess?: () => void;
  // 'inline' drops the Card chrome and title so the form can sit inside another section; it
  // is also narrower, keeps the submit button content-width and carries the forgot-password link.
  variant?: 'card' | 'inline';
}) {
  const inline = variant === 'inline';
  const { refreshUser } = useAuth();
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { oldPassword: '', newPassword: '', confirmNewPassword: '' },
  });

  async function onSubmit(values: ChangePasswordFormValues) {
    setServerError(null);
    const payload: ChangePasswordRequest = {
      oldPassword: values.oldPassword,
      newPassword: values.newPassword,
    };
    try {
      await apiClient.patch('/auth/change-password', payload);
      form.reset({ oldPassword: '', newPassword: '', confirmNewPassword: '' });
      await refreshUser();
      toast.success('เปลี่ยนรหัสผ่านสำเร็จ');
      onSuccess?.();
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        setServerError('รหัสผ่านปัจจุบันไม่ถูกต้อง');
      } else {
        setServerError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      }
    }
  }

  const fields = (
    <>
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      <FormField
        control={form.control}
        name="oldPassword"
        render={({ field }) => (
          <FormItem>
            <FormLabel>รหัสผ่านปัจจุบัน</FormLabel>
            <FormControl>
              <PasswordInput autoComplete="current-password" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {inline && (
        <p className="text-xs text-muted-foreground">
          จำรหัสผ่านปัจจุบันไม่ได้?{' '}
          <Link
            href="/forgot-password"
            className="inline-flex min-h-11 items-center text-primary hover:underline"
          >
            ไปที่หน้าลืมรหัสผ่าน
          </Link>
        </p>
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
      <Button
        type="submit"
        className={inline ? 'w-full sm:w-auto' : 'w-full'}
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
      </Button>
    </>
  );

  if (inline) {
    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-[480px] space-y-4">
          {fields}
        </form>
      </Form>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">{fields}</CardContent>
        </form>
      </Form>
    </Card>
  );
}
