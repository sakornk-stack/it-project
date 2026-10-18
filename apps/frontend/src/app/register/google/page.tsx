'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type {
  AccessTokenResponse,
  CompleteGoogleRegistrationRequest,
} from '@eduanalyze-ai/shared-types';
import { apiClient } from '@/lib/api-client';
import { describeApiError } from '@/lib/describe-api-error';
import { OWN_SENTENCE_ONLY, RATE_LIMITED_ERROR } from '@/lib/api-error-presets';
import { useAuth } from '@/lib/auth-context';
import { takeTokenFromUrl } from '@/lib/signup-domain';
import { PRIVACY_POLICY_VERSION, STALE_PRIVACY_POLICY_MESSAGE } from '@/lib/privacy-policy';
import { isStalePrivacyPolicyError } from '@/lib/privacy-policy-error';
import {
  completeGoogleRegistrationSchema,
  type CompleteGoogleRegistrationFormValues,
} from '@/lib/validation/complete-google-registration.schema';
import { AuthHeading } from '@/components/auth/auth-heading';
import { AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { DependentOrgSelect } from '@/components/auth/dependent-org-select';
import { PrivacyConsentField } from '@/components/auth/privacy-consent-field';
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
  title: 'สมัครสมาชิกให้เสร็จสมบูรณ์',
  description: 'กรอกข้อมูลการศึกษาที่เหลือ เพื่อเริ่มใช้งานระบบด้วยบัญชี Google ของคุณ',
};

export default function CompleteGoogleRegistrationPage() {
  return (
    <Suspense>
      <CompleteGoogleRegistrationForm />
    </Suspense>
  );
}

function CompleteGoogleRegistrationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Read once into state, then taken out of the address bar (it must not stay
  // in history or a Referer). A reload therefore needs a fresh Google sign-in,
  // which the 10-minute pending session allows anyway.
  const [pendingToken] = useState(() => searchParams.get('pendingToken') ?? '');
  useEffect(() => {
    takeTokenFromUrl(window, 'pendingToken');
  }, []);
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<CompleteGoogleRegistrationFormValues>({
    resolver: zodResolver(completeGoogleRegistrationSchema),
    defaultValues: {
      studentCode: '',
      facultyId: '',
      departmentId: '',
      programId: '',
      curriculumId: '',
      acceptPrivacyPolicy: false,
    },
  });

  async function onSubmit(values: CompleteGoogleRegistrationFormValues) {
    setServerError(null);
    const payload: CompleteGoogleRegistrationRequest = {
      pendingToken,
      studentCode: values.studentCode,
      programId: values.programId,
      curriculumId: values.curriculumId,
      admissionYear: values.admissionYear,
      acceptPrivacyPolicy: true,
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
    };
    try {
      const { data } = await apiClient.post<AccessTokenResponse>(
        '/auth/google/complete-registration',
        payload,
      );
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
            401: 'เซสชันหมดอายุ กรุณาเริ่มเข้าสู่ระบบด้วย Google ใหม่',
            409: 'รหัสนิสิตนี้ถูกใช้งานแล้ว',
          },
          undefined,
          OWN_SENTENCE_ONLY,
        ),
      );
    }
  }

  if (!pendingToken) {
    return (
      <AuthSplitLayout {...BRAND_COPY}>
        <AuthHeading title="ข้อมูลนิสิต" />
        <Alert variant="destructive">
          <AlertDescription>
            ไม่พบข้อมูลการสมัคร กรุณาเริ่มเข้าสู่ระบบด้วย Google ใหม่
          </AlertDescription>
        </Alert>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout {...BRAND_COPY}>
      <AuthHeading
        title="ข้อมูลนิสิต"
        description="กรอกข้อมูลที่เหลือเพื่อสมัครสมาชิกให้เสร็จสมบูรณ์"
      />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Alert>
            <AlertDescription>
              แบบฟอร์มนี้สำหรับนิสิตที่สมัครใช้งานครั้งแรกเท่านั้น หากคุณควรมีบัญชีเจ้าหน้าที่ อาจารย์
              หรือผู้ดูแลระบบ กรุณาติดต่อผู้ดูแลระบบเพื่อขอบัญชีแทนการกรอกแบบฟอร์มนี้
            </AlertDescription>
          </Alert>
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
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
                  {/* The form value starts undefined (so an empty field keeps its "enter the
                      year" message); '' keeps the <input> controlled from the first render. */}
                  <Input type="number" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <DependentOrgSelect />
          <PrivacyConsentField />
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'กำลังบันทึก...' : 'เสร็จสิ้นการสมัคร'}
          </Button>
        </form>
      </Form>
    </AuthSplitLayout>
  );
}
