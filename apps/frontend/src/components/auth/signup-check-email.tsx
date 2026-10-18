'use client';

import { useEffect, useState } from 'react';
import { MailCheck } from 'lucide-react';
import type { ResendEmailSignupRequest, SignupStartedResponse } from '@eduanalyze-ai/shared-types';
import { apiClient } from '@/lib/api-client';
import { describeApiError } from '@/lib/describe-api-error';
import { OWN_SENTENCE_ONLY, RATE_LIMITED_ERROR } from '@/lib/api-error-presets';
import { SIGNUP_RESEND_COOLDOWN_SECONDS } from '@/lib/signup-domain';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

// Shown after a self-service sign-up: no account exists yet, only a mailed
// link. The wording never says whether the address already had an account
// (the server answers every address the same way).
export function SignupCheckEmail({
  email,
  onStartOver,
}: Readonly<{ email: string; onStartOver: () => void }>) {
  const [secondsLeft, setSecondsLeft] = useState(SIGNUP_RESEND_COOLDOWN_SECONDS);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [secondsLeft]);

  async function resend() {
    setSending(true);
    setError(null);
    setStatus(null);
    const payload: ResendEmailSignupRequest = { email };
    try {
      const { data } = await apiClient.post<SignupStartedResponse>(
        '/auth/register/resend',
        payload,
      );
      setStatus(data.message);
      setSecondsLeft(SIGNUP_RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(describeApiError(err, RATE_LIMITED_ERROR, undefined, OWN_SENTENCE_ONLY));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border bg-brand-light p-4">
        <MailCheck size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-brand" />
        <div className="min-w-0 space-y-1 text-sm">
          <p className="font-medium text-primary">ตรวจสอบอีเมลของคุณ</p>
          <p className="break-words text-muted-foreground">
            หากอีเมล <span className="font-medium text-primary">{email}</span> สมัครได้
            เราได้ส่งลิงก์ยืนยันไปแล้ว กดลิงก์ในอีเมลภายใน 30 นาทีเพื่อเปิดใช้บัญชี
            บัญชีจะยังไม่ถูกสร้างจนกว่าจะยืนยัน
          </p>
        </div>
      </div>

      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {status}
      </p>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:flex-1"
          disabled={secondsLeft > 0 || sending}
          onClick={resend}
        >
          {sending
            ? 'กำลังส่ง...'
            : secondsLeft > 0
              ? `ส่งลิงก์อีกครั้งได้ใน ${secondsLeft} วินาที`
              : 'ส่งลิงก์อีกครั้ง'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 w-full sm:w-auto"
          onClick={onStartOver}
        >
          แก้ไขข้อมูลการสมัคร
        </Button>
      </div>
    </div>
  );
}
