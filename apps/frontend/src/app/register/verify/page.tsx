'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isAxiosError } from 'axios';
import type {
  AccessTokenResponse,
  ResendEmailSignupRequest,
  SignupStartedResponse,
  VerifyEmailSignupRequest,
} from '@eduanalyze-ai/shared-types';
import { apiClient } from '@/lib/api-client';
import { describeApiError } from '@/lib/describe-api-error';
import { OWN_SENTENCE_ONLY, RATE_LIMITED_ERROR } from '@/lib/api-error-presets';
import { useAuth } from '@/lib/auth-context';
import { takeTokenFromUrl } from '@/lib/signup-domain';
import { AuthHeading } from '@/components/auth/auth-heading';
import { AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const BRAND_COPY = {
  title: 'ยืนยันอีเมล',
  description: 'ขั้นตอนสุดท้ายของการสมัคร บัญชีจะถูกสร้างเมื่อคุณกดยืนยัน',
};

const INVALID_LINK =
  'ลิงก์ยืนยันหมดอายุหรือถูกใช้ไปแล้ว กรอกอีเมลด้านล่างเพื่อขอลิงก์ใหม่ หรือสมัครใหม่';

type Stage = 'loading' | 'ready' | 'invalid';

// Landing page of the verification mail. The token is taken out of the URL on
// mount and only sent when the person presses the button — a mail scanner that
// "visits" links therefore cannot use it up.
export default function VerifyEmailSignupPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('loading');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const found = takeTokenFromUrl(window);
    setToken(found);
    setStage(found ? 'ready' : 'invalid');
  }, []);

  async function verify() {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    const payload: VerifyEmailSignupRequest = { token };
    try {
      const { data } = await apiClient.post<AccessTokenResponse>('/auth/register/verify', payload);
      await login(data.accessToken);
      router.push('/dashboard');
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 401) {
        setStage('invalid');
        setSubmitting(false);
        return;
      }
      // 409 (email or student code taken) carries the server's own Thai sentence.
      setError(describeApiError(err, RATE_LIMITED_ERROR));
      setSubmitting(false);
    }
  }

  return (
    <AuthSplitLayout {...BRAND_COPY}>
      <AuthHeading
        title="ยืนยันอีเมลและเปิดใช้บัญชี"
        description="กดปุ่มด้านล่างเพื่อยืนยันว่าอีเมลนี้เป็นของคุณ"
      />

      {stage === 'ready' && (
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="button" className="min-h-11 w-full" disabled={submitting} onClick={verify}>
            {submitting ? 'กำลังยืนยัน...' : 'ยืนยันอีเมลและเปิดใช้บัญชี'}
          </Button>
          {error && (
            <Button asChild variant="ghost" className="min-h-11 w-full">
              <Link href="/login">ไปหน้าเข้าสู่ระบบ</Link>
            </Button>
          )}
        </div>
      )}

      {stage === 'invalid' && <InvalidLink />}
    </AuthSplitLayout>
  );
}

function InvalidLink() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function resend(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    setStatus(null);
    const payload: ResendEmailSignupRequest = { email: email.trim() };
    try {
      const { data } = await apiClient.post<SignupStartedResponse>(
        '/auth/register/resend',
        payload,
      );
      setStatus(data.message);
    } catch (err) {
      setError(describeApiError(err, RATE_LIMITED_ERROR, undefined, OWN_SENTENCE_ONLY));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Alert role="alert">
        <AlertDescription>{INVALID_LINK}</AlertDescription>
      </Alert>
      <form onSubmit={resend} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="resend-email">อีเมลที่ใช้สมัคร</Label>
          <Input
            id="resend-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {status}
        </p>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" variant="outline" className="min-h-11 w-full" disabled={sending}>
          {sending ? 'กำลังส่ง...' : 'ขอลิงก์ยืนยันใหม่'}
        </Button>
      </form>
      <Button asChild variant="ghost" className="min-h-11 w-full">
        <Link href="/register">สมัครใหม่</Link>
      </Button>
    </div>
  );
}
